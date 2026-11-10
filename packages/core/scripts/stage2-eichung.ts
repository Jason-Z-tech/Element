/**
 * Eichung von Stufe 2: bestimmt Achsenabschnitt a und Steigung b des Einschuss-Abstands
 * nur an den Eich-Reaktionen (48Ca + 238U, 242Pu, 243Am, 248Cm, 249Bk).
 * Die Prüf-Reaktionen werden hier nicht angefasst.
 *
 *   npx tsx scripts/stage2-eichung.ts [Kaskaden je Drehimpuls] [Seed]
 */
import { calibrate, chiSquare, logResidual, measurementsByRole, modelValue, prepareMeasurements } from '../src/stage2/calibration';
import type { ModelParameters } from '../src/stage2/model';

declare const console: { log(...args: unknown[]): void };
declare const process: { argv: string[] };

const cascades = Number(process.argv[2] ?? 150);
const seed = Number(process.argv[3] ?? 20261110);
const variant = process.argv[4] ?? 'standard';
const base: ModelParameters = {
  sInjA_fm: 0,
  sInjB_fmPerMeV: 0,
  orientationDependentInjection: true,
  potential: variant === 'hagino-ws' ? { kind: 'woods-saxon', v0_MeV: 70, r0_fm: 1.18, a_fm: 0.69 } : { kind: 'bass' },
  nTheta: 24,
  barrierCoefficients: variant === 'fbd2003' ? 'fbd2003' : 'fbd2011',
};
console.log(`Variante: ${variant}`);

const t0 = Date.now();
const rows = measurementsByRole('eichung');
const prepared = prepareMeasurements(rows, base, cascades, seed);
console.log(`${rows.length} Eich-Messungen vorbereitet in ${((Date.now() - t0) / 1000).toFixed(1)} s (${cascades} Kaskaden je Drehimpuls, Seed ${seed})`);

const fit = calibrate(prepared);
console.log(`\nErgebnis: a = ${fit.a_fm.toFixed(3)} fm, b = ${fit.b_fmPerMeV.toFixed(4)} fm/MeV, chi² = ${fit.chi2.toFixed(1)} bei ${fit.points} Punkten`);
for (const [name, a, b] of [['Hagino 2018', 4.698, 0.16], ['Cap et al. 2022', 3.291, 0.196], ['Siwek-Wilczyńska et al. 2012', 4.09, 0.192]] as const) {
  console.log(`  zum Vergleich ${name}: a = ${a}, b = ${b}: chi² = ${chiSquare(prepared, a, b).toFixed(1)}`);
}

console.log('\nid    Reaktion        xn  E_cm    Messung (pb)            Rechnung (pb)   Rechnung/Messung  Abw. (σ)  nötige Verschiebung von s_inj (fm)');
let sumLog = 0;
let sumLog2 = 0;
const shifts: number[] = [];
for (const m of prepared) {
  const v = modelValue(m, fit.a_fm, fit.b_fmPerMeV);
  const ratio = v.sigma_pb / m.row.sigma_pb;
  sumLog += Math.log10(ratio);
  sumLog2 += Math.log10(ratio) ** 2;
  // Verschiebung des Einschuss-Abstands, mit der die Rechnung die Messung genau trifft
  let lo = -4;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (modelValue(m, fit.a_fm + mid, fit.b_fmPerMeV).sigma_pb > m.row.sigma_pb) lo = mid;
    else hi = mid;
  }
  const shift = 0.5 * (lo + hi);
  shifts.push(shift);
  console.log(
    `${m.row.id.padEnd(5)} ${(m.prep.reaction.id).padEnd(14)} ${m.row.neutrons}n  ${m.energies[Math.floor(m.energies.length / 2)]!.toFixed(1)}  ` +
      `${String(m.row.sigma_pb).padStart(6)} +${String(m.row.errPlus_pb).padEnd(6)} -${String(m.row.errMinus_pb).padEnd(6)}  ${v.sigma_pb.toPrecision(3).padStart(9)}  ` +
      `${ratio.toPrecision(3).padStart(8)}        ${logResidual(v.sigma_pb, m.row).toFixed(2).padStart(6)}   ${shift.toFixed(2).padStart(6)}`,
  );
}
const n = prepared.length;
const meanLog = sumLog / n;
const rmsLog = Math.sqrt(sumLog2 / n);
const meanShift = shifts.reduce((s, x) => s + x, 0) / n;
const sdShift = Math.sqrt(shifts.reduce((s, x) => s + (x - meanShift) ** 2, 0) / (n - 1));
console.log(`\nMittlere Abweichung: Faktor ${Math.pow(10, meanLog).toFixed(2)} (Mittel der Logarithmen), Streuung: Faktor ${Math.pow(10, rmsLog).toFixed(2)} (quadratisches Mittel)`);
console.log(`Nötige Verschiebung von s_inj: Mittel ${meanShift.toFixed(2)} fm, Standardabweichung ${sdShift.toFixed(2)} fm`);
console.log(`Laufzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
