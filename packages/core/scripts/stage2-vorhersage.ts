/**
 * Referenz-Vorhersage für die Elemente 119 und 120 mit dem eingefrorenen Modell.
 *
 *   npx tsx scripts/stage2-vorhersage.ts <Index der Reaktion 0…5>   rechnet eine Reaktion
 *   npx tsx scripts/stage2-vorhersage.ts zusammenfassen             fasst die Teile zusammen
 *
 * Schreibt docs/daten/stufe2-vorhersagen.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stage2 } from '../src';

declare const console: { log(...args: unknown[]): void };
declare const process: { argv: string[] };

const arg = process.argv[2] ?? '0';
const dir = '../../docs/daten';
const part = (i: number): string => `${dir}/.vorhersage-teil-${i}.json`;
const { seed, members, cascades } = stage2.PREDICTION_RUN;

if (arg === 'zusammenfassen') {
  const reactions = stage2.PREDICTION_REACTIONS.map((_, i) => {
    if (!existsSync(part(i))) throw new Error(`Teil ${i} fehlt`);
    return JSON.parse(readFileSync(part(i), 'utf8'));
  });
  const file = {
    modelVersion: stage2.STAGE2_MODEL_VERSION,
    createdAt: new Date().toISOString(),
    parameters: stage2.STAGE2_PARAMETERS,
    uncertainties: stage2.UNCERTAINTIES,
    seed,
    members,
    cascades,
    note: 'Simulation, keine Messung. Das Modell hat die Prüfung an gemessenen Reaktionen nicht bestanden und rechnet dort meist zu tief (siehe stufe2-pruefung.json).',
    reactions,
  };
  writeFileSync(`${dir}/stufe2-vorhersagen.json`, JSON.stringify(file, null, 1) + '\n');
  console.log(`zusammengefasst: ${reactions.length} Reaktionen, erstellt ${file.createdAt}`);
} else {
  const index = Number(arg);
  const reaction = stage2.PREDICTION_REACTIONS[index]!;
  const prep = stage2.prepareReaction(reaction, stage2.STAGE2_PARAMETERS);
  const jobs = stage2.predictionJobs(new Map([[reaction.id, prep]])).filter((j) => j.reactionIndex === index);
  const t0 = Date.now();
  const points = jobs.map((job) => {
    const nominal = stage2.crossSections(prep, job.eCm_MeV, { cascades: 40000, seed: job.seed });
    const values = stage2.runEnsemblePacket(prep, stage2.predictionPacket(job, 0, members));
    const channels = [2, 3, 4, 5].map((x) => {
      const b = stage2.band(values, members, x);
      const n = nominal.channels[x - 1]!;
      return { neutrons: x, sigma_fb: n.sigma_pb * 1000, statError_fb: n.statError_pb * 1000, low_fb: b.low * 1000, median_fb: b.median * 1000, high_fb: b.high * 1000 };
    });
    // Summe der Kanäle 2n bis 5n je Ziehung
    const sums: number[] = [];
    for (let m = 0; m < members; m++) {
      let s = 0;
      for (let x = 2; x <= 5; x++) s += values[m * stage2.MAX_NEUTRONS + x - 1]!;
      sums.push(s * 1000);
    }
    sums.sort((a, b) => a - b);
    const q = (p: number): number => sums[Math.min(members - 1, Math.round(p * (members - 1)))]!;
    return {
      eStar_MeV: job.eStar_MeV,
      eCm_MeV: Number(job.eCm_MeV.toFixed(3)),
      eLab_MeV: Number(job.eLab_MeV.toFixed(3)),
      seed: job.seed,
      sigmaCapture_mb: nominal.sigmaCapture_pb / 1e9,
      fusionProbability: nominal.sigmaFusion_pb / nominal.sigmaCapture_pb,
      channels,
      total: { sigma_fb: channels.reduce((s, c) => s + c.sigma_fb, 0), low_fb: q(0.1587), median_fb: q(0.5), high_fb: q(0.8413) },
    };
  });
  writeFileSync(part(index), JSON.stringify({ id: reaction.id, element: reaction.element, label: reaction.label, compound: `${prep.compound.a}-${prep.compound.z}`, qValue_MeV: Number(prep.qValue.toFixed(3)), b0_MeV: Number(prep.b0.toFixed(2)), points }, null, 1) + '\n');
  const best = points.reduce((a, b) => (b.total.sigma_fb > a.total.sigma_fb ? b : a));
  console.log(`${reaction.id}: ${points.length} Energien in ${((Date.now() - t0) / 1000).toFixed(0)} s; Maximum ${best.total.sigma_fb.toPrecision(2)} fb bei E* ${best.eStar_MeV} MeV`);
}
