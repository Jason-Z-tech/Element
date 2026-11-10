import type { Reaction } from './data/reactions';
import { mulberry32 } from './rng';

/**
 * Die „Natur“: die wahren Anregungsfunktionen, nach denen die Simulation
 * Fusionen würfelt. Entweder die veröffentlichten Werte oder eine verdeckte,
 * zufällig verschobene Variante, die der Spieler durch Messreihen finden muss.
 */
export interface NatureChannel {
  readonly neutrons: number;
  readonly sigmaMax_fb: number;
  readonly eStarPeak_MeV: number;
  readonly width_MeV: number;
  readonly residue: string | null;
}

export interface Nature {
  readonly reactionId: string;
  readonly hidden: boolean;
  readonly channels: readonly NatureChannel[];
}

/** Gauß-Anregungsfunktion eines Kanals in fb. */
export function channelCrossSection_fb(ch: NatureChannel, eStar_MeV: number): number {
  const d = (eStar_MeV - ch.eStarPeak_MeV) / ch.width_MeV;
  return ch.sigmaMax_fb * Math.exp(-0.5 * d * d);
}

/** Summe über alle Kanäle in fb. */
export function totalCrossSection_fb(nature: Nature, eStar_MeV: number): number {
  let sum = 0;
  for (const ch of nature.channels) sum += channelCrossSection_fb(ch, eStar_MeV);
  return sum;
}

/** Natur nach den veröffentlichten Werten (Messung bzw. Vorhersage). */
export function publishedNature(reaction: Reaction): Nature {
  return {
    reactionId: reaction.id,
    hidden: false,
    channels: reaction.channels.map((c) => ({
      neutrons: c.neutrons,
      sigmaMax_fb: c.sigmaMax.value,
      eStarPeak_MeV: c.eStarPeak.value,
      width_MeV: c.width.value,
      residue: c.residue,
    })),
  };
}

/** Maximum der Summenkurve (Abtasten in 0,01-MeV-Schritten). */
export function findMaximum(nature: Nature): { eStar_MeV: number; sigma_fb: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of nature.channels) {
    lo = Math.min(lo, c.eStarPeak_MeV - 3 * c.width_MeV);
    hi = Math.max(hi, c.eStarPeak_MeV + 3 * c.width_MeV);
  }
  let best = { eStar_MeV: lo, sigma_fb: -Infinity };
  const steps = Math.round((hi - lo) / 0.01);
  for (let i = 0; i <= steps; i++) {
    const e = lo + i * 0.01;
    const s = totalCrossSection_fb(nature, e);
    if (s > best.sigma_fb) best = { eStar_MeV: e, sigma_fb: s };
  }
  return best;
}

/** Grenzen des Modus „verdeckte Natur“ (Projektvorgabe). */
export const HIDDEN_NATURE = {
  sigmaMaxMin_fb: 6,
  sigmaMaxMax_fb: 80,
  maxShift_MeV: 5,
} as const;

/**
 * Modus „verdeckte Natur“: Das wahre Maximum der Summenkurve liegt zufällig
 * zwischen 6 und 80 fb, die beste Energie ist um bis zu ±5 MeV verschoben.
 * Alle Kanäle werden gemeinsam skaliert und verschoben; die Form bleibt.
 *
 * Annahme (nicht vorgegeben): Das Maximum wird logarithmisch gleichverteilt
 * gezogen (jede Größenordnung gleich wahrscheinlich), die Verschiebung
 * gleichverteilt.
 */
export function hiddenNature(reaction: Reaction, seed: number): Nature {
  const base = publishedNature(reaction);
  const rng = mulberry32(seed);
  const { sigmaMaxMin_fb: a, sigmaMaxMax_fb: b, maxShift_MeV } = HIDDEN_NATURE;
  const sigmaMax = a * Math.pow(b / a, rng.next());
  const shift = (2 * rng.next() - 1) * maxShift_MeV;
  const scale = sigmaMax / findMaximum(base).sigma_fb;
  return {
    reactionId: reaction.id,
    hidden: true,
    channels: base.channels.map((c) => ({
      ...c,
      sigmaMax_fb: c.sigmaMax_fb * scale,
      eStarPeak_MeV: c.eStarPeak_MeV + shift,
    })),
  };
}
