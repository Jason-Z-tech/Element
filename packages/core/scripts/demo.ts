/**
 * Zeigt auf der Konsole, was Stufe 1 kann:  npm run demo
 */
import {
  bassBarrier,
  BERKELEY_RUN,
  chainEfficiency,
  CORE_VERSION,
  DEFAULTS,
  eLabForExcitation,
  findMaximum,
  getReaction,
  hiddenNature,
  publishedNature,
  REACTIONS,
  runExperiment,
  SECONDS_PER_DAY,
  STAGE1_MODEL_VERSION,
  type ChainStep,
  type RunResult,
} from '../src';

// Der Kern wird bewusst ohne DOM- und Node-Typen geprüft; die Konsole wird hier nur angemeldet.
declare const console: { log(...args: unknown[]): void };

const f = (x: number, digits = 1): string => x.toFixed(digits).replace('.', ',');

function time(t: number): string {
  if (t < 1e-3) return `${f(t * 1e6, 0)} µs`;
  if (t < 1) return `${f(t * 1e3, 2)} ms`;
  return `${f(t, 2)} s`;
}

function step(s: ChainStep): string {
  const mark = s.estimated ? '~' : '';
  if (s.type === 'sf') return `${s.nuclide}: Spaltung nach ${mark}${time(s.dt_s)}`;
  const e = s.energy_MeV === null ? 'E offen' : `${mark}${f(s.energy_MeV, 2)} MeV`;
  return `${s.nuclide}: α ${s.fullEnergy ? e : 'entwischt'} nach ${mark}${time(s.dt_s)}`;
}

function report(r: RunResult): void {
  const a = r.analysis;
  console.log(
    `  E_lab ${f(r.settings.eLab_MeV)} MeV, E_cm ${f(r.eCm_MeV)} MeV, E* ${f(r.eStar_MeV)} MeV, ` +
      `${f(r.settings.beamTime_s / SECONDS_PER_DAY)} Tage, Seed ${r.settings.seed}`,
  );
  for (const e of r.events) {
    console.log(
      `    Tag ${f(e.time_s / SECONDS_PER_DAY, 2)}  ${e.neutrons}n  ${e.verdict.identified ? 'KETTE ' : 'verworfen'}  ` +
        e.steps.map(step).join(' → ') +
        (e.endsAt ? ` → ${e.endsAt} (Ende)` : ''),
    );
  }
  for (const c of r.channels) {
    if (c.identified === null) console.log(`    ${c.neutrons}n: ${c.implanted} Kerne erzeugt, Zerfallsdaten offen – nicht nachweisbar`);
  }
  if (a.upperLimit_fb !== null) console.log(`  Ergebnis: 0 Ketten, Obergrenze ${f(a.upperLimit_fb)} fb (1,84 Ereignisse)`);
  else console.log(`  Ergebnis: ${a.chains} Ketten, σ = ${f(a.sigma_fb)} +${f(a.errHigh_fb)} −${f(a.errLow_fb)} fb (68 %)`);
}

console.log(`Elementjäger core ${CORE_VERSION}, Modell ${STAGE1_MODEL_VERSION}`);
console.log('Das ist eine Simulation. Eine Entdeckung ist erst das im Beschleuniger gemessene Atom.\n');

console.log('Bass-Barrieren (Bass 1977):');
for (const r of Object.values(REACTIONS)) {
  const b = bassBarrier(r.projectile.z, r.projectile.a, r.target.z, r.target.a);
  console.log(`  ${r.id}: ${f(b.height_MeV, 2)} MeV bei ${f(b.radius_fm, 2)} fm`);
}

console.log('\nKetten-Effizienz nach der Zählregel (exakt gerechnet):');
for (const id of ['290Lv', '295-120', '296-120']) console.log(`  ${id}: ${f(100 * chainEfficiency(id), 3)} %`);

const days = BERKELEY_RUN.days.value;
const base = {
  beamPerSecond: DEFAULTS.beamPerSecond.value,
  thickness_mg_cm2: DEFAULTS.targetThickness.value,
};

console.log('\nTestlauf Berkeley: 50Ti + 244Pu, 22,1 Tage, drei verschiedene Seeds');
const pu = publishedNature(getReaction('Ti50+Pu244'));
for (const seed of [1, 2, 3]) {
  report(
    runExperiment(
      { ...base, reactionId: 'Ti50+Pu244', eLab_MeV: eLabForExcitation('Ti50+Pu244', 41), beamTime_s: days * SECONDS_PER_DAY, seed },
      pu,
    ),
  );
}

let sum = 0;
const runs = 20000;
for (let seed = 1; seed <= runs; seed++) {
  sum += runExperiment(
    { ...base, reactionId: 'Ti50+Pu244', eLab_MeV: eLabForExcitation('Ti50+Pu244', 41), beamTime_s: days * SECONDS_PER_DAY, seed },
    pu,
  ).analysis.chains;
}
console.log(`  Mittel über ${runs} Wiederholungen: ${f(sum / runs, 3)} Ketten in 22,1 Tagen (Eichziel: 2)`);

console.log('\nHauptreaktion: 50Ti + 249Cf → Element 120, 300 Tage bei E* = 41 MeV');
const cf = publishedNature(getReaction('Ti50+Cf249'));
report(
  runExperiment(
    { ...base, reactionId: 'Ti50+Cf249', eLab_MeV: eLabForExcitation('Ti50+Cf249', 41), beamTime_s: 300 * SECONDS_PER_DAY, seed: 120 },
    cf,
  ),
);

console.log('\nModus „verdeckte Natur“ (Seed 7): Messreihe mit je 400 Tagen');
const hidden = hiddenNature(getReaction('Ti50+Cf249'), 7);
for (let eStar = 32; eStar <= 50; eStar += 3) {
  const r = runExperiment(
    { ...base, reactionId: 'Ti50+Cf249', eLab_MeV: eLabForExcitation('Ti50+Cf249', eStar), beamTime_s: 400 * SECONDS_PER_DAY, seed: eStar },
    hidden,
  );
  const a = r.analysis;
  console.log(
    `  E* ${eStar} MeV: ` +
      (a.upperLimit_fb !== null
        ? `0 Ketten, < ${f(a.upperLimit_fb)} fb`
        : `${a.chains} Ketten, ${f(a.sigma_fb)} +${f(a.errHigh_fb)} −${f(a.errLow_fb)} fb`),
  );
}
const truth = findMaximum(hidden);
console.log(`  Auflösung: wahres Maximum ${f(truth.sigma_fb)} fb bei E* ${f(truth.eStar_MeV)} MeV`);
