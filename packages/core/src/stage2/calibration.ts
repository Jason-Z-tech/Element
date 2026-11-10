import { MEASUREMENTS, type MeasurementRow } from '../data/stage2/measurements';
import { deriveSeed } from '../rng';
import {
  combineWithSurvival,
  fusionStage,
  prepareReaction,
  survivalTable,
  type ModelParameters,
  type PreparedReaction,
  type SurvivalTable,
} from './model';

/** Zahl der Energien, über die innerhalb der Targetdicke gemittelt wird. */
const ENERGY_POINTS = 5;
/** Größter Drehimpuls in den Überlebens-Tabellen der Eichung. */
const L_MAX = 70;

/** Eine Messung mit allem, was zum Vergleich mit der Rechnung vorbereitet ist. */
export interface PreparedMeasurement {
  readonly row: MeasurementRow;
  readonly prep: PreparedReaction;
  /** Schwerpunktsenergien, über die gemittelt wird. */
  readonly energies: readonly number[];
  readonly survival: readonly SurvivalTable[];
}

export function reactionOf(row: MeasurementRow): { id: string; projectile: { symbol: string; z: number; a: number }; target: { symbol: string; z: number; a: number } } {
  const [ps, pz, pa] = row.projectile;
  const [ts, tz, ta] = row.target;
  return { id: `${ps}${pa}+${ts}${ta}`, projectile: { symbol: ps, z: pz, a: pa }, target: { symbol: ts, z: tz, a: ta } };
}

/** Schwerpunktsenergie einer Messung; wo nur E* bekannt ist, mit dem Q-Wert der Massentabelle umgerechnet. */
export function measurementEnergy(row: MeasurementRow, prep: PreparedReaction): number {
  if (row.eCm !== null) return row.eCm;
  if (row.eStar === null) throw new Error(`Messung ${row.id} hat keine Energie`);
  return row.eStar - prep.qValue;
}

/**
 * Bereitet Messungen vor: Barrieren je Reaktion, Überlebens-Tabellen je Energie.
 * Die Überlebens-Tabellen hängen nicht von den Eichgrößen ab.
 */
export function prepareMeasurements(
  rows: readonly MeasurementRow[],
  params: ModelParameters,
  cascadesPerL: number,
  seed: number,
): PreparedMeasurement[] {
  const preps = new Map<string, PreparedReaction>();
  return rows.map((row, index) => {
    const reaction = reactionOf(row);
    let prep = preps.get(reaction.id);
    if (!prep) {
      prep = prepareReaction(reaction, params);
      preps.set(reaction.id, prep);
    }
    const center = measurementEnergy(row, prep);
    const energies: number[] = [];
    const n = row.width > 0 ? ENERGY_POINTS : 1;
    for (let j = 0; j < n; j++) energies.push(n === 1 ? center : center - row.width / 2 + (row.width * (j + 0.5)) / n);
    const survival = energies.map((e, j) => survivalTable(prep!, e + prep!.qValue, L_MAX, cascadesPerL, deriveSeed(seed, index, j)));
    return { row, prep, energies, survival };
  });
}

/** Rechnung für eine Messung: Mittel über die Targetdicke, in pb. */
export function modelValue(m: PreparedMeasurement, a: number, b: number): { sigma_pb: number; statError_pb: number } {
  const prep: PreparedReaction = { ...m.prep, params: { ...m.prep.params, sInjA_fm: a, sInjB_fmPerMeV: b } };
  let sum = 0;
  let variance = 0;
  for (let j = 0; j < m.energies.length; j++) {
    const fusion = fusionStage(prep, m.energies[j]!);
    const channel = combineWithSurvival(fusion, m.survival[j]!)[m.row.neutrons - 1]!;
    sum += channel.sigma_pb;
    variance += channel.statError_pb * channel.statError_pb;
  }
  const n = m.energies.length;
  return { sigma_pb: sum / n, statError_pb: Math.sqrt(variance) / n };
}

/**
 * Abweichung Rechnung gegen Messung im Logarithmus, in Einheiten des Messfehlers
 * (unsymmetrisch: liegt die Rechnung über der Messung, zählt der obere Fehler).
 */
export function logResidual(model_pb: number, row: MeasurementRow): number {
  const floor = 1e-12;
  const diff = Math.log(Math.max(model_pb, floor) / row.sigma_pb);
  const upper = Math.log((row.sigma_pb + row.errPlus_pb) / row.sigma_pb);
  const lowerValue = Math.max(row.sigma_pb - row.errMinus_pb, 0.1 * row.sigma_pb);
  const lower = Math.log(row.sigma_pb / lowerValue);
  return diff / (diff >= 0 ? upper : lower);
}

export function chiSquare(measurements: readonly PreparedMeasurement[], a: number, b: number): number {
  let chi2 = 0;
  for (const m of measurements) {
    const r = logResidual(modelValue(m, a, b).sigma_pb, m.row);
    chi2 += r * r;
  }
  return chi2;
}

export interface CalibrationResult {
  readonly a_fm: number;
  readonly b_fmPerMeV: number;
  readonly chi2: number;
  readonly points: number;
}

/** Sucht a und b: grobes Raster, dann schrittweise Verfeinerung (ohne Ableitungen). */
export function calibrate(measurements: readonly PreparedMeasurement[]): CalibrationResult {
  let best = { a: 0, b: 0, chi2: Infinity };
  for (let a = 0; a <= 8; a += 0.5) {
    for (let b = 0; b <= 0.5; b += 0.025) {
      const chi2 = chiSquare(measurements, a, b);
      if (chi2 < best.chi2) best = { a, b, chi2 };
    }
  }
  let stepA = 0.25;
  let stepB = 0.0125;
  for (let iter = 0; iter < 60 && stepA > 1e-4; iter++) {
    let improved = false;
    for (const [da, db] of [[stepA, 0], [-stepA, 0], [0, stepB], [0, -stepB], [stepA, stepB], [-stepA, -stepB], [stepA, -stepB], [-stepA, stepB]] as const) {
      const a = best.a + da;
      const b = best.b + db;
      if (b < 0) continue;
      const chi2 = chiSquare(measurements, a, b);
      if (chi2 < best.chi2 - 1e-9) {
        best = { a, b, chi2 };
        improved = true;
      }
    }
    if (!improved) {
      stepA /= 2;
      stepB /= 2;
    }
  }
  return { a_fm: best.a, b_fmPerMeV: best.b, chi2: best.chi2, points: measurements.length };
}

export function measurementsByRole(role: MeasurementRow['role']): MeasurementRow[] {
  return MEASUREMENTS.filter((m) => m.role === role);
}
