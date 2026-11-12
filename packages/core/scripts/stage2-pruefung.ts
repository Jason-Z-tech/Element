/**
 * Messwert gegen Rechnung mit dem eingefrorenen Parametersatz.
 *
 *   npx tsx scripts/stage2-pruefung.ts eichung            nur die Eich-Reaktionen
 *   npx tsx scripts/stage2-pruefung.ts pruefung           die Prüf-Reaktionen (erster und einziger Blick)
 *   npx tsx scripts/stage2-pruefung.ts grenzen            Obergrenzen aus erfolglosen Suchen
 *
 * Schreibt docs/daten/stufe2-<Teil>.json.
 */
import { writeFileSync } from 'node:fs';
import { stage2 } from '../src';

declare const console: { log(...args: unknown[]): void };
declare const process: { argv: string[] };

const part = process.argv[2] ?? 'eichung';
const members = Number(process.argv[3] ?? 300);
const cascades = Number(process.argv[4] ?? 300);
const seed = 20261110;
const P = stage2.STAGE2_PARAMETERS;
const preps = new Map<string, stage2.PreparedReaction>();
const prepare = (r: stage2.Reaction2): stage2.PreparedReaction => {
  let p = preps.get(r.id);
  if (!p) {
    p = stage2.prepareReaction(r, P);
    preps.set(r.id, p);
  }
  return p;
};
const fmt = (x: number): string => (x >= 100 ? x.toFixed(0) : x >= 1 ? x.toFixed(2) : x.toPrecision(2));

function nominal(prep: stage2.PreparedReaction, energies: readonly number[], n: number, s: number): number[] {
  const out = new Array<number>(stage2.MAX_NEUTRONS).fill(0);
  energies.forEach((e, j) => {
    const r = stage2.crossSections(prep, e, { cascades: n, seed: s + j });
    r.channels.forEach((c, i) => (out[i] = out[i]! + c.sigma_pb / energies.length));
  });
  return out;
}

if (part === 'eichung' || part === 'pruefung') {
  const rows = stage2.MEASUREMENTS.filter((m) => m.role === part);
  const results: unknown[] = [];
  let sumLog = 0;
  let sumLog2 = 0;
  let inside = 0;
  const groups = new Map<string, { n: number; sum: number; sum2: number; inside: number }>();
  console.log(`${part}: ${rows.length} Messungen, ${members} Ziehungen, ${cascades} Kaskaden je Ziehung, Modell ${stage2.STAGE2_MODEL_VERSION}`);
  console.log('id    Reaktion      xn  E_cm   E*    Messung (pb)          Rechnung   68-%-Band              Rechnung/Messung  im Band');
  rows.forEach((row, index) => {
    const prep = prepare(stage2.reactionOf(row));
    const center = stage2.measurementEnergy(row, prep);
    const n = row.width > 0 ? 5 : 1;
    const energies = Array.from({ length: n }, (_, j) => (n === 1 ? center : center - row.width / 2 + (row.width * (j + 0.5)) / n));
    const value = nominal(prep, energies, 20000, seed + 1000 * index)[row.neutrons - 1]!;
    const packet = stage2.runEnsemblePacket(prep, { reactionId: prep.reaction.id, energies, seed: seed + index, firstMember: 0, members, cascades });
    const b = stage2.band(packet, members, row.neutrons);
    const ratio = value / row.sigma_pb;
    const lg = Math.log10(Math.max(ratio, 1e-6));
    const hit = row.sigma_pb + row.errPlus_pb >= b.low && row.sigma_pb - row.errMinus_pb <= b.high;
    sumLog += lg;
    sumLog2 += lg * lg;
    if (hit) inside++;
    const key = row.projectile[0] === 'Ca' ? '48Ca' : 'schwerer als 48Ca';
    const g = groups.get(key) ?? { n: 0, sum: 0, sum2: 0, inside: 0 };
    g.n++;
    g.sum += lg;
    g.sum2 += lg * lg;
    if (hit) g.inside++;
    groups.set(key, g);
    console.log(
      `${row.id.padEnd(5)} ${prep.reaction.id.padEnd(13)} ${row.neutrons}n  ${center.toFixed(1)}  ${(center + prep.qValue).toFixed(1)}  ` +
        `${String(row.sigma_pb).padStart(6)} +${String(row.errPlus_pb).padEnd(6)} -${String(row.errMinus_pb).padEnd(6)} ${fmt(value).padStart(8)}   ` +
        `${fmt(b.low).padStart(7)} … ${fmt(b.high).padEnd(7)} (Median ${fmt(b.median)})`.padEnd(40) +
        `${(ratio >= 1 ? '× ' + fmt(ratio) : '÷ ' + fmt(1 / ratio)).padStart(9)}        ${hit ? 'ja' : 'nein'}`,
    );
    results.push({
      id: row.id, role: row.role, reaction: prep.reaction.id, neutrons: row.neutrons, eCm: center, eStarModel: center + prep.qValue,
      eStarPaper: row.eStar, width: row.width, energyFrom: row.energyFrom, measured_pb: row.sigma_pb, errPlus_pb: row.errPlus_pb, errMinus_pb: row.errMinus_pb,
      lab: row.lab, reference: row.reference, status: row.status, model_pb: value, bandLow_pb: b.low, bandMedian_pb: b.median, bandHigh_pb: b.high, ratio, inBand: hit,
    });
  });
  const n = rows.length;
  const summary = { part, points: n, meanFactor: Math.pow(10, sumLog / n), scatterFactor: Math.pow(10, Math.sqrt(sumLog2 / n)), inBand: inside, groups: [...groups.entries()].map(([name, g]) => ({ name, points: g.n, meanFactor: Math.pow(10, g.sum / g.n), scatterFactor: Math.pow(10, Math.sqrt(g.sum2 / g.n)), inBand: g.inside })) };
  console.log(`\nAlle ${n}: mittlere Abweichung Faktor ${summary.meanFactor.toFixed(2)}, Streuung Faktor ${summary.scatterFactor.toFixed(1)}, Messung im 68-%-Band: ${inside} von ${n}`);
  for (const g of summary.groups) console.log(`  ${g.name}: ${g.points} Punkte, mittlere Abweichung Faktor ${g.meanFactor.toFixed(2)}, Streuung Faktor ${g.scatterFactor.toFixed(1)}, im Band ${g.inBand} von ${g.points}`);
  writeFileSync(`../../docs/daten/stufe2-${part}.json`, JSON.stringify({ modelVersion: stage2.STAGE2_MODEL_VERSION, parameters: P, seed, members, cascades, summary, results }, null, 1) + '\n');
}

if (part === 'grenzen') {
  const limits: [string, [string, number, number], [string, number, number], number, string][] = [
    ['50Ti + 249Cf → 120', ['Ti', 22, 50], ['Cf', 98, 249], 0.2, 'TASCA, GSI (PRC 102, 064602)'],
    ['50Ti + 249Bk → 119', ['Ti', 22, 50], ['Bk', 97, 249], 0.065, 'TASCA, GSI (PRC 102, 064602)'],
    ['54Cr + 248Cm → 120', ['Cr', 24, 54], ['Cm', 96, 248], 0.58, 'SHIP, GSI'],
    ['58Fe + 244Pu → 120', ['Fe', 26, 58], ['Pu', 94, 244], 0.4, 'Dubna 2009'],
    ['64Ni + 238U → 120', ['Ni', 28, 64], ['U', 92, 238], 0.09, 'SHIP, GSI'],
    ['50Ti + 248Cm → Og', ['Ti', 22, 50], ['Cm', 96, 248], 0.5, 'RIKEN 2025'],
  ];
  const results: unknown[] = [];
  console.log('Obergrenzen: größter gerechneter Wirkungsquerschnitt (Summe 2n bis 5n) über E* = 26 bis 54 MeV');
  limits.forEach(([label, p, t, limit, lab], index) => {
    const prep = prepare({ id: `${p[0]}${p[2]}+${t[0]}${t[2]}`, projectile: { symbol: p[0], z: p[1], a: p[2] }, target: { symbol: t[0], z: t[1], a: t[2] } });
    let best = { e: 0, sum: -1 };
    for (let eStar = 26; eStar <= 54; eStar += 2) {
      const e = eStar - prep.qValue;
      const ch = nominal(prep, [e], 4000, seed + index * 100 + eStar);
      const sum = ch[1]! + ch[2]! + ch[3]! + ch[4]!;
      if (sum > best.sum) best = { e, sum };
    }
    const packet = stage2.runEnsemblePacket(prep, { reactionId: prep.reaction.id, energies: [best.e], seed: seed + 500 + index, firstMember: 0, members, cascades });
    const sums: number[] = [];
    for (let m = 0; m < members; m++) {
      let s = 0;
      for (let x = 2; x <= 5; x++) s += packet[m * stage2.MAX_NEUTRONS + x - 1]!;
      sums.push(s);
    }
    sums.sort((a, b) => a - b);
    const q = (f: number): number => sums[Math.min(sums.length - 1, Math.floor(f * sums.length))]!;
    const above = sums.filter((s) => s > limit).length / members;
    console.log(`${label.padEnd(22)} Grenze < ${fmt(limit * 1000)} fb (${lab}): Rechnung ${fmt(best.sum * 1000)} fb bei E* ${(best.e + prep.qValue).toFixed(0)} MeV, 68-%-Band ${fmt(q(0.1587) * 1000)} … ${fmt(q(0.8413) * 1000)} fb, Anteil der Ziehungen über der Grenze ${(100 * above).toFixed(0)} %`);
    results.push({ label, reaction: prep.reaction.id, limit_pb: limit, lab, eStarAtMax: best.e + prep.qValue, eCmAtMax: best.e, modelMax_pb: best.sum, bandLow_pb: q(0.1587), bandHigh_pb: q(0.8413), fractionAboveLimit: above });
  });
  writeFileSync('../../docs/daten/stufe2-grenzen.json', JSON.stringify({ modelVersion: stage2.STAGE2_MODEL_VERSION, seed, members, cascades, results }, null, 1) + '\n');
}
