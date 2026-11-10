import { mulberry32 } from '../rng';
import { buildBarrierTable, shapeFactor, transmission, type BarrierTable, type NuclearPotential } from './capture';
import { FM2_IN_PB, ROT_CONST } from './constants';
import {
  diffusionProbability,
  fusionGeometry,
  levelDensityParameter,
  meanBarrierB0,
  momentOfInertiaDeformed,
  momentOfInertiaInjection,
  pairingEnergy,
  rotationalEnergy,
  smoothLevelDensityParameter,
  vFiss,
  type BarrierCoefficientSet,
  type FusionGeometry,
} from './fusion';
import { getHeavyNucleus, measuredMassExcess, targetDeformation, type Deformation, type HeavyNucleus } from './nuclei';
import { buildChain, cascade, createWorkspace, MAX_NEUTRONS, type ChainNucleus } from './survival';

export interface Nuclide {
  readonly symbol: string;
  readonly z: number;
  readonly a: number;
}

export interface Reaction2 {
  readonly id: string;
  readonly projectile: Nuclide;
  readonly target: Nuclide;
}

/** Festgelegte Größen des Modells. Geeicht werden nur `sInjA_fm` und `sInjB_fmPerMeV`. */
export interface ModelParameters {
  /** Einschuss-Abstand s₀ = a − b (E − B₀): Achsenabschnitt in fm. */
  readonly sInjA_fm: number;
  /** Steigung in fm/MeV. */
  readonly sInjB_fmPerMeV: number;
  /** Winkelabhängigkeit des Einschuss-Abstands (Hagino 2018, Gl. 34). */
  readonly orientationDependentInjection: boolean;
  readonly potential: NuclearPotential;
  /** Zahl der Winkel-Stützstellen. */
  readonly nTheta: number;
  /** Deformation des Targets; Standard: FRDM(2012). */
  readonly deformation?: Deformation;
  /** Koeffizientensatz der inneren Barriere; Standard: `fbd2011`. */
  readonly barrierCoefficients?: BarrierCoefficientSet;
}

/** Zufällige Verschiebungen der unsicheren Eingangsgrößen (für die Unsicherheits-Ensembles). */
export interface Perturbation {
  /** Verschiebung der Spaltbarriere je Kern der Kette in MeV (Index = abgedampfte Neutronen). */
  readonly bfShifts: ArrayLike<number>;
  /** Verschiebung des Einschuss-Abstands in fm. */
  readonly sInjShift_fm: number;
  /** Verschiebung des Q-Werts in MeV. */
  readonly qShift_MeV: number;
  /** Verschiebung aller Einfang-Barrieren in MeV. */
  readonly barrierShift_MeV: number;
}

export const NO_PERTURBATION: Perturbation = {
  bfShifts: new Float64Array(MAX_NEUTRONS + 2),
  sInjShift_fm: 0,
  qShift_MeV: 0,
  barrierShift_MeV: 0,
};

/** Alles, was für eine Reaktion nur einmal gerechnet werden muss. */
export interface PreparedReaction {
  readonly reaction: Reaction2;
  readonly params: ModelParameters;
  readonly compound: HeavyNucleus;
  readonly chain: readonly ChainNucleus[];
  readonly geometry: FusionGeometry;
  readonly barriers: BarrierTable;
  /** Q-Wert in MeV: Massen von Projektil und Target aus AME2020, Compoundkern aus der Warschauer Tabelle. */
  readonly qValue: number;
  /** Mittlere Barriere B₀ in MeV. */
  readonly b0: number;
  /** R_T Σ β_λ Y_λ0(θ) je Winkel-Stützstelle in fm. */
  readonly injectionShift: Float64Array;
}

export function prepareReaction(reaction: Reaction2, params: ModelParameters): PreparedReaction {
  const { projectile: p, target: t } = reaction;
  const compound = getHeavyNucleus(p.z + t.z, p.a + t.a);
  const deformation = params.deformation ?? targetDeformation(t.z, t.a);
  const geometry = fusionGeometry(p.z, p.a, t.z, t.a, params.barrierCoefficients);
  const barriers = buildBarrierTable(
    { zp: p.z, ap: p.a, zt: t.z, at: t.a, deformation, potential: params.potential },
    params.nTheta,
  );
  const injectionShift = new Float64Array(barriers.nTheta);
  for (let i = 0; i < barriers.nTheta; i++) {
    // R_T = 1,2 A^(1/3) fm wie im Coulomb-Potential: Mit diesem Radius ergibt sich der Unterschied
    // zwischen Spitze und Flanke in Haginos Abb. 3(b) (1,92 fm für 48Ca + 248Cm).
    injectionShift[i] = params.orientationDependentInjection
      ? 1.2 * Math.cbrt(t.a) * shapeFactor(deformation, barriers.cosTheta[i]!)
      : 0;
  }
  return {
    reaction,
    params,
    compound,
    chain: buildChain(compound.z, compound.a),
    geometry,
    barriers,
    qValue: measuredMassExcess(p.z, p.a) + measuredMassExcess(t.z, t.a) - compound.massExcess,
    b0: meanBarrierB0(p.z, p.a, t.z, t.a),
    injectionShift,
  };
}

export interface FusionResult {
  readonly eCm: number;
  readonly eStar: number;
  /** Einschuss-Abstand s₀ in fm (ohne Winkelanteil). */
  readonly sInj0_fm: number;
  readonly sigmaCapture_pb: number;
  readonly sigmaFusion_pb: number;
  /** Beitrag jedes Drehimpulses zu σ_fus in pb. */
  readonly partial: Float64Array;
}

/**
 * Einfang und Verschmelzen (ohne Zufall): Summe über ℓ und Gauß-Legendre-Integral
 * über den Winkel.
 */
export function fusionStage(prep: PreparedReaction, eCm: number, pert: Perturbation = NO_PERTURBATION): FusionResult {
  const { reaction, params, compound: cn, geometry: g, barriers } = prep;
  const ap = reaction.projectile.a;
  const at = reaction.target.a;
  const eStar = eCm + prep.qValue + pert.qShift_MeV;
  // Cap et al. 2022: negative Abstände sind unphysikalisch, also bei 0 abschneiden.
  const s0 = Math.max(0, params.sInjA_fm - params.sInjB_fmPerMeV * (eCm - prep.b0) + pert.sInjShift_fm);
  const pair = pairingEnergy(cn.z, cn.a);
  const bf = cn.bf + (pert.bfShifts[0] ?? 0);
  const vSaddle = cn.eGround + bf;
  const inertiaSaddle = momentOfInertiaDeformed(cn.a, cn.alphaSaddle);
  const aSmoothSaddle = smoothLevelDensityParameter(cn.a, cn.alphaSaddle);

  const nTheta = barriers.nTheta;
  const vInj = new Float64Array(nTheta);
  const inertiaInj = new Float64Array(nTheta);
  const aInj = new Float64Array(nTheta);
  for (let i = 0; i < nTheta; i++) {
    const s = Math.max(g.s0 * g.r, s0 + prep.injectionShift[i]!);
    vInj[i] = vFiss(g, s);
    inertiaInj[i] = momentOfInertiaInjection(g, ap, at, s);
    aInj[i] = smoothLevelDensityParameter(cn.a, (s / g.r - g.s0) / 2);
  }

  const mu = (ap * at) / (ap + at);
  const prefactor = ((Math.PI * ROT_CONST) / (mu * eCm)) * FM2_IN_PB;
  const partial = new Float64Array(barriers.lMax + 1);
  let sigmaCapture = 0;
  let sigmaFusion = 0;
  for (let l = 0; l <= barriers.lMax; l++) {
    const rotSaddle = rotationalEnergy(l, inertiaSaddle);
    const uSaddle = eStar - bf - rotSaddle - pair;
    const tSaddle = uSaddle > 0 ? Math.sqrt(uSaddle / levelDensityParameter(aSmoothSaddle, cn.shellSaddle, uSaddle)) : 0;
    let capture = 0;
    let fusion = 0;
    for (let i = 0; i < nTheta; i++) {
      const t = transmission(barriers, i, l, eCm, pert.barrierShift_MeV);
      if (t <= 0) continue;
      const w = barriers.weight[i]! * t;
      capture += w;
      if (tSaddle <= 0) continue;
      const rotInj = rotationalEnergy(l, inertiaInj[i]!);
      const uInj = eStar + cn.eGround - vInj[i]! - rotInj - pair;
      if (uInj <= 0) continue;
      const temperature = Math.sqrt(tSaddle * Math.sqrt(uInj / aInj[i]!));
      const deltaV = vSaddle + rotSaddle - (vInj[i]! + rotInj);
      fusion += w * diffusionProbability(deltaV, temperature);
    }
    const factor = prefactor * (2 * l + 1);
    sigmaCapture += factor * capture;
    partial[l] = factor * fusion;
    sigmaFusion += partial[l]!;
    if (l > 10 && capture < 1e-12) break;
  }
  return { eCm, eStar, sInj0_fm: s0, sigmaCapture_pb: sigmaCapture, sigmaFusion_pb: sigmaFusion, partial };
}

export interface ChannelCrossSection {
  /** Zahl der abgedampften Neutronen. */
  readonly neutrons: number;
  readonly sigma_pb: number;
  /** Statistischer Fehler der Monte-Carlo-Kaskade (68 %) in pb. */
  readonly statError_pb: number;
}

export interface CrossSectionResult extends FusionResult {
  readonly channels: readonly ChannelCrossSection[];
  readonly cascades: number;
  readonly seed: number;
}

/**
 * Überleben per Monte Carlo: Der Drehimpuls wird nach seinem Beitrag zu σ_fus
 * gezogen (geschichtet), die Neutronenenergien aus dem Verdampfungsspektrum.
 */
export function evaporationStage(
  prep: PreparedReaction,
  fusion: FusionResult,
  cascades: number,
  seed: number,
  pert: Perturbation = NO_PERTURBATION,
): ChannelCrossSection[] {
  const channels: ChannelCrossSection[] = [];
  const sum = new Float64Array(MAX_NEUTRONS + 1);
  const sum2 = new Float64Array(MAX_NEUTRONS + 1);
  const total = fusion.sigmaFusion_pb;
  if (total > 0 && cascades > 0) {
    const rng = mulberry32(seed);
    const work = createWorkspace();
    const out = new Float64Array(1);
    const partial = fusion.partial;
    let l = 0;
    let cumulative = partial[0]!;
    for (let i = 0; i < cascades; i++) {
      // Geschichtete Ziehung: u wächst von Wurf zu Wurf, also wandert ℓ nur vorwärts.
      const target = ((i + rng.next()) / cascades) * total;
      while (cumulative < target && l < partial.length - 1) {
        l++;
        cumulative += partial[l]!;
      }
      const x = cascade(prep.chain, fusion.eStar, l, pert.bfShifts, rng, work, out);
      if (x >= 0) {
        sum[x] = sum[x]! + out[0]!;
        sum2[x] = sum2[x]! + out[0]! * out[0]!;
      }
    }
  }
  for (let x = 1; x <= MAX_NEUTRONS; x++) {
    const mean = cascades > 0 ? sum[x]! / cascades : 0;
    const variance = cascades > 1 ? Math.max(0, sum2[x]! / cascades - mean * mean) / (cascades - 1) : 0;
    channels.push({ neutrons: x, sigma_pb: total * mean, statError_pb: total * Math.sqrt(variance) });
  }
  return channels;
}

export interface CrossSectionOptions {
  readonly cascades: number;
  readonly seed: number;
  readonly perturbation?: Perturbation;
}

/** Wirkungsquerschnitte aller xn-Kanäle bei einer Schwerpunktsenergie. */
export function crossSections(prep: PreparedReaction, eCm: number, options: CrossSectionOptions): CrossSectionResult {
  const pert = options.perturbation ?? NO_PERTURBATION;
  const fusion = fusionStage(prep, eCm, pert);
  return {
    ...fusion,
    channels: evaporationStage(prep, fusion, options.cascades, options.seed, pert),
    cascades: options.cascades,
    seed: options.seed,
  };
}

/**
 * Überlebens-Wahrscheinlichkeiten je Drehimpuls: W_x(ℓ) für x = 0 … MAX_NEUTRONS.
 * Hängt nicht vom Einschuss-Abstand ab und kann deshalb für die Eichung einmal
 * gerechnet und wiederverwendet werden.
 */
export interface SurvivalTable {
  readonly eStar: number;
  readonly lMax: number;
  readonly cascadesPerL: number;
  /** Mittelwert, Index ℓ · (MAX_NEUTRONS + 1) + x. */
  readonly mean: Float64Array;
  /** Varianz des Mittelwerts, gleicher Index. */
  readonly variance: Float64Array;
}

export function survivalTable(
  prep: PreparedReaction,
  eStar: number,
  lMax: number,
  cascadesPerL: number,
  seed: number,
  pert: Perturbation = NO_PERTURBATION,
): SurvivalTable {
  const width = MAX_NEUTRONS + 1;
  const mean = new Float64Array((lMax + 1) * width);
  const variance = new Float64Array((lMax + 1) * width);
  const rng = mulberry32(seed);
  const work = createWorkspace();
  const out = new Float64Array(1);
  const sum = new Float64Array(width);
  const sum2 = new Float64Array(width);
  for (let l = 0; l <= lMax; l++) {
    sum.fill(0);
    sum2.fill(0);
    for (let i = 0; i < cascadesPerL; i++) {
      const x = cascade(prep.chain, eStar, l, pert.bfShifts, rng, work, out);
      if (x >= 0) {
        sum[x] = sum[x]! + out[0]!;
        sum2[x] = sum2[x]! + out[0]! * out[0]!;
      }
    }
    for (let x = 0; x < width; x++) {
      const m = sum[x]! / cascadesPerL;
      mean[l * width + x] = m;
      variance[l * width + x] = cascadesPerL > 1 ? Math.max(0, sum2[x]! / cascadesPerL - m * m) / (cascadesPerL - 1) : 0;
    }
  }
  return { eStar, lMax, cascadesPerL, mean, variance };
}

/** σ_xn = Σ_ℓ σ_fus(ℓ) · W_x(ℓ) aus einem Fusions-Ergebnis und einer Überlebens-Tabelle. */
export function combineWithSurvival(fusion: FusionResult, table: SurvivalTable): ChannelCrossSection[] {
  const width = MAX_NEUTRONS + 1;
  const channels: ChannelCrossSection[] = [];
  for (let x = 1; x <= MAX_NEUTRONS; x++) {
    let sigma = 0;
    let variance = 0;
    const n = Math.min(table.lMax, fusion.partial.length - 1);
    for (let l = 0; l <= n; l++) {
      const p = fusion.partial[l]!;
      sigma += p * table.mean[l * width + x]!;
      variance += p * p * table.variance[l * width + x]!;
    }
    channels.push({ neutrons: x, sigma_pb: sigma, statError_pb: Math.sqrt(variance) });
  }
  return channels;
}
