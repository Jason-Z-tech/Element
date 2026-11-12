import { deriveSeed, mulberry32, type Rng } from '../rng';
import { crossSections, type Perturbation, type PreparedReaction } from './model';
import { UNCERTAINTIES } from './parameters';
import { MAX_NEUTRONS } from './survival';

/**
 * Unsicherheits-Ensemble: Die unsicheren Eingangsgrößen werden zufällig gezogen,
 * und für jede Ziehung wird die ganze Kette gerechnet. Jede Ziehung hängt nur von
 * (Seed, Nummer) ab; so lässt sich ein Ensemble in Pakete teilen und von zwei
 * Rechnern unabhängig nachrechnen.
 */

function normal(rng: Rng): number {
  // Box-Muller; u1 liegt in (0, 1].
  const u1 = 1 - rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Zieht die Verschiebungen für die Ziehung `member`. */
export function drawPerturbation(seed: number, member: number): Perturbation {
  const rng = mulberry32(deriveSeed(seed, member, 0));
  const bfShifts = new Float64Array(MAX_NEUTRONS + 2);
  for (let k = 0; k < bfShifts.length; k++) bfShifts[k] = UNCERTAINTIES.fissionBarrier_MeV.sigma * normal(rng);
  return {
    bfShifts,
    sInjShift_fm: UNCERTAINTIES.injectionDistance_fm.sigma * normal(rng),
    qShift_MeV: UNCERTAINTIES.qValue_MeV.sigma * normal(rng),
    barrierShift_MeV: UNCERTAINTIES.captureBarrier_MeV.sigma * normal(rng),
  };
}

export interface EnsemblePacket {
  readonly reactionId: string;
  /** Schwerpunktsenergien, über die gemittelt wird (meist eine). */
  readonly energies: readonly number[];
  readonly seed: number;
  /** Erste Ziehung und Zahl der Ziehungen dieses Pakets. */
  readonly firstMember: number;
  readonly members: number;
  /** Kaskaden je Ziehung und Energie. */
  readonly cascades: number;
}

/**
 * Rechnet ein Paket. Ergebnis: je Ziehung die Wirkungsquerschnitte der Kanäle
 * 1n … MAX_NEUTRONS in pb, hintereinander in einem Feld (members × MAX_NEUTRONS).
 */
export function runEnsemblePacket(prep: PreparedReaction, packet: EnsemblePacket): Float64Array {
  const out = new Float64Array(packet.members * MAX_NEUTRONS);
  for (let m = 0; m < packet.members; m++) {
    const member = packet.firstMember + m;
    const perturbation = drawPerturbation(packet.seed, member);
    for (let j = 0; j < packet.energies.length; j++) {
      const result = crossSections(prep, packet.energies[j]!, {
        cascades: packet.cascades,
        seed: deriveSeed(packet.seed, member, 1 + j),
        perturbation,
      });
      for (let x = 1; x <= MAX_NEUTRONS; x++) {
        out[m * MAX_NEUTRONS + x - 1] = out[m * MAX_NEUTRONS + x - 1]! + result.channels[x - 1]!.sigma_pb / packet.energies.length;
      }
    }
  }
  return out;
}

export interface Band {
  /** 16-%-, 50-%- und 84-%-Quantil in pb. */
  readonly low: number;
  readonly median: number;
  readonly high: number;
  readonly members: number;
}

/** Quantile eines Kanals aus den gesammelten Ziehungen. */
export function band(values: ArrayLike<number>, members: number, neutrons: number): Band {
  const v: number[] = [];
  for (let m = 0; m < members; m++) v.push(values[m * MAX_NEUTRONS + neutrons - 1]!);
  v.sort((a, b) => a - b);
  const q = (p: number): number => {
    const pos = p * (v.length - 1);
    const i = Math.floor(pos);
    const f = pos - i;
    return v[i]! * (1 - f) + (v[Math.min(i + 1, v.length - 1)] ?? v[i]!) * f;
  };
  return { low: q(0.1587), median: q(0.5), high: q(0.8413), members };
}

/** Band der Summe der Kanäle 2n bis 5n in pb aus den gesammelten Ziehungen. */
export function totalBand(values: ArrayLike<number>, members: number): Band {
  const sums: number[] = [];
  for (let m = 0; m < members; m++) {
    let s = 0;
    for (let x = 2; x <= 5; x++) s += values[m * MAX_NEUTRONS + x - 1]!;
    sums.push(s);
  }
  sums.sort((a, b) => a - b);
  const q = (p: number): number => sums[Math.min(members - 1, Math.round(p * (members - 1)))]!;
  return { low: q(0.1587), median: q(0.5), high: q(0.8413), members };
}
