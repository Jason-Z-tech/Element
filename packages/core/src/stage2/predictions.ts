import { deriveSeed } from '../rng';
import type { EnsemblePacket } from './ensemble';
import { prepareReaction, type PreparedReaction, type Reaction2 } from './model';
import { STAGE2_PARAMETERS } from './parameters';

/** Reaktionen, für die Vorhersagen gerechnet werden (so vereinbart). */
export interface PredictionReaction extends Reaction2 {
  /** Ordnungszahl des gesuchten Elements. */
  readonly element: 119 | 120;
  readonly label: string;
}

export const PREDICTION_REACTIONS: readonly PredictionReaction[] = [
  { id: 'Ti50+Cf249', element: 120, label: '⁵⁰Ti + ²⁴⁹Cf', projectile: { symbol: 'Ti', z: 22, a: 50 }, target: { symbol: 'Cf', z: 98, a: 249 } },
  { id: 'Cr54+Cm248', element: 120, label: '⁵⁴Cr + ²⁴⁸Cm', projectile: { symbol: 'Cr', z: 24, a: 54 }, target: { symbol: 'Cm', z: 96, a: 248 } },
  { id: 'V51+Bk249', element: 120, label: '⁵¹V + ²⁴⁹Bk', projectile: { symbol: 'V', z: 23, a: 51 }, target: { symbol: 'Bk', z: 97, a: 249 } },
  { id: 'Ti50+Bk249', element: 119, label: '⁵⁰Ti + ²⁴⁹Bk', projectile: { symbol: 'Ti', z: 22, a: 50 }, target: { symbol: 'Bk', z: 97, a: 249 } },
  { id: 'V51+Cm248', element: 119, label: '⁵¹V + ²⁴⁸Cm', projectile: { symbol: 'V', z: 23, a: 51 }, target: { symbol: 'Cm', z: 96, a: 248 } },
  { id: 'Cr54+Am243', element: 119, label: '⁵⁴Cr + ²⁴³Am', projectile: { symbol: 'Cr', z: 24, a: 54 }, target: { symbol: 'Am', z: 95, a: 243 } },
];

/** Raster der Anregungsenergien: 30 MeV Bereich in Schritten von 2 MeV. */
export const PREDICTION_GRID = { eStarMin_MeV: 26, eStarMax_MeV: 56, step_MeV: 2 } as const;

/** Seed, Zahl der Ziehungen und Kaskaden der Referenz-Vorhersage. */
export const PREDICTION_RUN = { seed: 119120, members: 1000, cascades: 500 } as const;

export function predictionEnergies(): number[] {
  const out: number[] = [];
  for (let e = PREDICTION_GRID.eStarMin_MeV; e <= PREDICTION_GRID.eStarMax_MeV + 1e-9; e += PREDICTION_GRID.step_MeV) out.push(e);
  return out;
}

export function getPredictionReaction(id: string): PredictionReaction {
  const r = PREDICTION_REACTIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Unbekannte Vorhersage-Reaktion ${id}`);
  return r;
}

/** Ein Ensemble der Vorhersage: eine Reaktion bei einer Anregungsenergie. */
export interface PredictionJob {
  readonly reactionId: string;
  readonly reactionIndex: number;
  readonly energyIndex: number;
  /** Anregungsenergie mit dem Q-Wert der Massentabelle. */
  readonly eStar_MeV: number;
  readonly eCm_MeV: number;
  readonly eLab_MeV: number;
  readonly seed: number;
}

/** Alle Ensembles einer vollen Vorhersage (6 Reaktionen × 16 Energien). */
export function predictionJobs(prepared?: ReadonlyMap<string, PreparedReaction>): PredictionJob[] {
  const jobs: PredictionJob[] = [];
  PREDICTION_REACTIONS.forEach((reaction, reactionIndex) => {
    const prep = prepared?.get(reaction.id) ?? prepareReaction(reaction, STAGE2_PARAMETERS);
    predictionEnergies().forEach((eStar, energyIndex) => {
      const eCm = eStar - prep.qValue;
      jobs.push({
        reactionId: reaction.id,
        reactionIndex,
        energyIndex,
        eStar_MeV: eStar,
        eCm_MeV: eCm,
        eLab_MeV: (eCm * (reaction.projectile.a + reaction.target.a)) / reaction.target.a,
        seed: deriveSeed(PREDICTION_RUN.seed, reactionIndex, energyIndex),
      });
    });
  });
  return jobs;
}

/** Paket für einen Abschnitt der Ziehungen eines Ensembles. */
export function predictionPacket(job: PredictionJob, firstMember: number, members: number, cascades: number = PREDICTION_RUN.cascades): EnsemblePacket {
  return { reactionId: job.reactionId, energies: [job.eCm_MeV], seed: job.seed, firstMember, members, cascades };
}
