import type { Rng } from '../rng';
import { HBARC, NEUTRON_MASS } from './constants';
import {
  levelDensityParameter,
  momentOfInertiaDeformed,
  pairingEnergy,
  rotationalEnergy,
  smoothLevelDensityParameter,
} from './fusion';
import { findHeavyNucleus } from './nuclei';

/**
 * Stufe C: Überleben. Neutronen-Abdampfung gegen Spaltung, Schritt für Schritt
 * (Cap, Kowal, Siwek-Wilczyńska 2022, Gl. 10–12; ausgeschrieben bei Hagino 2018,
 * Gl. 12–16 und A25–A29).
 */

/** Radiuskonstante des Einfangquerschnitts für Neutronen, σ_n = π r₀² A^(2/3) (Hagino 2018, nach Gl. 15). */
export const R0_NEUTRON_CAPTURE = 1.45;

/** Vorfaktor von Γ_n/Γ_f = c · A^(2/3) · I_n / I_f mit c = 4 m_n r₀² / ħ² in 1/MeV. */
const WIDTH_RATIO_CONST = (4 * NEUTRON_MASS * R0_NEUTRON_CAPTURE * R0_NEUTRON_CAPTURE) / (HBARC * HBARC);

/** Ein Kern der Abdampf-Kette mit allem, was die Kaskade braucht. */
export interface ChainNucleus {
  readonly z: number;
  readonly a: number;
  readonly sn: number;
  readonly bf: number;
  readonly shellGround: number;
  readonly shellSaddle: number;
  readonly aSmoothGround: number;
  readonly aSmoothSaddle: number;
  readonly inertiaGround: number;
  readonly inertiaSaddle: number;
  readonly pairing: number;
}

/** Kette ab dem Compoundkern: Index k = Zahl der schon abgedampften Neutronen. */
export function buildChain(zCn: number, aCn: number, length = 9): ChainNucleus[] {
  const chain: ChainNucleus[] = [];
  for (let k = 0; k < length; k++) {
    const n = findHeavyNucleus(zCn, aCn - k);
    if (!n) break;
    chain.push({
      z: n.z,
      a: n.a,
      sn: n.sn,
      bf: n.bf,
      shellGround: n.shellGround,
      shellSaddle: n.shellSaddle,
      aSmoothGround: smoothLevelDensityParameter(n.a, n.alphaGround),
      aSmoothSaddle: smoothLevelDensityParameter(n.a, n.alphaSaddle),
      inertiaGround: momentOfInertiaDeformed(n.a, n.alphaGround),
      inertiaSaddle: momentOfInertiaDeformed(n.a, n.alphaSaddle),
      pairing: pairingEnergy(n.z, n.a),
    });
  }
  return chain;
}

/** Zahl der Stützstellen der Energie-Integrale. */
const GRID = 48;

/** Arbeitsfelder einer Kaskade; einmal anlegen, dann wiederverwenden (keine Speicheranforderung in der Schleife). */
export interface CascadeWorkspace {
  readonly cdf: Float64Array;
}

export function createWorkspace(): CascadeWorkspace {
  return { cdf: new Float64Array(GRID + 1) };
}

/** Exponent der Fermi-Gas-Niveaudichte: 2 √(a U) mit Schalendämpfung. */
function densityExponent(aSmooth: number, shell: number, u: number): number {
  if (u <= 0) return 0;
  return 2 * Math.sqrt(levelDensityParameter(aSmooth, shell, u) * u);
}

/**
 * Integral ∫₀^xMax ρ(xMax − x) x^power dx, ohne den Faktor exp(Bezug).
 * Stützstellen quadratisch verdichtet bei x = 0 (x = xMax t²). Füllt `cdf` mit
 * der laufenden Summe, damit daraus Energien gewürfelt werden können.
 */
function integrate(
  aSmooth: number,
  shell: number,
  xMax: number,
  power: 0 | 1,
  reference: number,
  cdf: Float64Array,
): number {
  let prev = 0;
  cdf[0] = 0;
  const dt = 1 / GRID;
  for (let i = 1; i <= GRID; i++) {
    const t = i * dt;
    const x = xMax * t * t;
    const rho = Math.exp(densityExponent(aSmooth, shell, xMax - x) - reference);
    // dx = 2 xMax t dt
    const value = rho * (power === 1 ? x : 1) * 2 * xMax * t;
    cdf[i] = cdf[i - 1]! + 0.5 * (prev + value) * dt;
    prev = value;
  }
  return cdf[GRID]!;
}

export interface WidthResult {
  /** Γ_n / (Γ_n + Γ_f). */
  readonly neutronProbability: number;
  /** Größte Bewegungsenergie des Neutrons in MeV; ≤ 0 heißt: kein Neutron möglich. */
  readonly epsMax: number;
  /** Verfügbare Energie am Sattel in MeV; ≤ 0 heißt: keine Spaltung möglich. */
  readonly kMax: number;
}

/**
 * Konkurrenz Neutron gegen Spaltung für den Kern `k` der Kette bei
 * Anregungsenergie `eStar` und Drehimpuls `l`. `bfShift` verschiebt die
 * Spaltbarriere (Unsicherheit). Füllt `work.cdf` mit dem Neutronenspektrum.
 */
export function widths(
  chain: readonly ChainNucleus[],
  k: number,
  eStar: number,
  l: number,
  bfShift: number,
  work: CascadeWorkspace,
): WidthResult {
  const parent = chain[k]!;
  const daughter = chain[k + 1];
  const kMax = eStar - (parent.bf + bfShift) - rotationalEnergy(l, parent.inertiaSaddle) - parent.pairing;
  const epsMax = daughter ? eStar - parent.sn - rotationalEnergy(l, daughter.inertiaGround) - daughter.pairing : -1;
  if (epsMax <= 0) return { neutronProbability: 0, epsMax, kMax };
  if (kMax <= 0) {
    integrate(daughter!.aSmoothGround, daughter!.shellGround, epsMax, 1, 0, work.cdf);
    return { neutronProbability: 1, epsMax, kMax };
  }
  const refF = densityExponent(parent.aSmoothSaddle, parent.shellSaddle, kMax);
  const refN = densityExponent(daughter!.aSmoothGround, daughter!.shellGround, epsMax);
  // Erst Spaltung (benutzt cdf als Zwischenspeicher), dann Neutron (cdf bleibt für das Würfeln stehen).
  const iF = integrate(parent.aSmoothSaddle, parent.shellSaddle, kMax, 0, refF, work.cdf);
  const iN = integrate(daughter!.aSmoothGround, daughter!.shellGround, epsMax, 1, refN, work.cdf);
  const ratio = WIDTH_RATIO_CONST * Math.pow(parent.a, 2 / 3) * Math.exp(refN - refF) * (iN / iF);
  return { neutronProbability: ratio / (1 + ratio), epsMax, kMax };
}

/** Würfelt die Bewegungsenergie des Neutrons aus dem zuletzt gerechneten Spektrum. */
export function sampleNeutronEnergy(work: CascadeWorkspace, epsMax: number, u: number): number {
  const cdf = work.cdf;
  const target = u * cdf[GRID]!;
  let lo = 0;
  let hi = GRID;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid]! <= target) lo = mid;
    else hi = mid;
  }
  const span = cdf[hi]! - cdf[lo]!;
  const t = (lo + (span > 0 ? (target - cdf[lo]!) / span : 0.5)) / GRID;
  return epsMax * t * t;
}

/** Größte verfolgte Neutronenzahl. */
export const MAX_NEUTRONS = 8;

/**
 * Eine Kaskade: multipliziert bei jedem Schritt das Gewicht mit Γ_n/(Γ_n + Γ_f),
 * würfelt die Neutronenenergie und senkt die Anregungsenergie. Endet, wenn
 * weder Neutron noch Spaltung möglich ist. Gibt die Zahl der abgedampften
 * Neutronen zurück und legt das Gewicht in `out[0]` ab; −1 = durch Spaltung verloren.
 */
export function cascade(
  chain: readonly ChainNucleus[],
  eStar: number,
  l: number,
  bfShifts: ArrayLike<number>,
  rng: Rng,
  work: CascadeWorkspace,
  out: Float64Array,
): number {
  let e = eStar;
  let weight = 1;
  for (let k = 0; k <= MAX_NEUTRONS && k < chain.length; k++) {
    const w = widths(chain, k, e, l, bfShifts[k] ?? 0, work);
    if (w.epsMax <= 0) {
      if (w.kMax > 0) return -1; // nur noch Spaltung möglich
      out[0] = weight;
      return k;
    }
    weight *= w.neutronProbability;
    if (weight === 0) return -1;
    const eps = sampleNeutronEnergy(work, w.epsMax, rng.next());
    e -= chain[k]!.sn + eps;
  }
  return -1;
}
