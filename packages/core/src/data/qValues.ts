import { q, type Quantity, type SourceId } from './sources';

/**
 * Q-Werte aus veröffentlichten Massentabellen, zum Vergleich mit den
 * Standardwerten der Reaktionen. Q = M(Projektil) + M(Target) − M(Compoundkern),
 * gerechnet mit Massenexzessen in MeV.
 */

/** Gemessene Massenexzesse (AME2020) in MeV. */
export const MASS_EXCESS_AME2020 = {
  He4: q(2.42491587, 'MeV', 'gemessen', 'ame2020'),
  Ti50: q(-51.431867, 'MeV', 'gemessen', 'ame2020', '±0,000082 MeV'),
  Pu244: q(59.806021, 'MeV', 'gemessen', 'ame2020', '±0,0023 MeV'),
  Cf249: q(69.722733, 'MeV', 'gemessen', 'ame2020', '±0,0012 MeV'),
  /** Extrapoliert aus der Systematik (in AME2020 mit # markiert), ±0,62 MeV. */
  Lv291: q(187.244, 'MeV', 'schaetzung', 'ame2020', 'In AME2020 mit # markiert: aus der Systematik extrapoliert, ±0,62 MeV.'),
} as const;

export interface CompoundMassModel {
  readonly id: string;
  readonly label: string;
  readonly source: SourceId;
  /** Massenexzess des Compoundkerns in MeV, je Reaktion. */
  readonly massExcess_MeV: Readonly<Record<string, number>>;
  readonly note?: string;
}

/** WS4: 299-120 über die Alpha-Kette an 291Lv (AME2020) angehängt. */
const WS4_Q_ALPHA_299_120 = 13.26; // Saxena et al., Tabelle 7 (WS4)
const WS4_Q_ALPHA_295_OG = 11.9; // Saxena et al., Tabelle 7 (WS4)
const WS4_HYBRID_299_120 =
  MASS_EXCESS_AME2020.Lv291.value +
  2 * MASS_EXCESS_AME2020.He4.value +
  WS4_Q_ALPHA_295_OG +
  WS4_Q_ALPHA_299_120;

/** Massenexzess der Compoundkerne 299-120 und 294Lv nach verschiedenen Modellen. */
export const COMPOUND_MASS_MODELS: readonly CompoundMassModel[] = [
  {
    id: 'frdm2012',
    label: 'FRDM(2012)',
    source: 'frdm2012',
    massExcess_MeV: { 'Ti50+Cf249': 213.11, 'Ti50+Pu244': 186.0 },
  },
  {
    id: 'frldm2012',
    label: 'FRLDM(2012)',
    source: 'frdm2012',
    massExcess_MeV: { 'Ti50+Cf249': 217.56, 'Ti50+Pu244': 189.56 },
    note: 'Zweites Modell derselben Arbeit (Tröpfchenmodell mit endlicher Reichweite).',
  },
  {
    id: 'jks2021',
    label: 'Jachimowicz–Kowal–Skalski (2021)',
    source: 'jks2021',
    massExcess_MeV: { 'Ti50+Cf249': 216.87, 'Ti50+Pu244': 190.41 },
  },
  {
    id: 'ws4-ame',
    label: 'WS4 (Alpha-Kette) + AME2020',
    source: 'ws4',
    massExcess_MeV: { 'Ti50+Cf249': WS4_HYBRID_299_120 },
    note: 'Keine reine WS4-Masse: M(291Lv) aus AME2020 (extrapoliert, ±0,62 MeV) plus Q_alpha von 295Og (11,90 MeV) und 299-120 (13,26 MeV) nach WS4. Die WS4-Tabelle selbst war nicht abrufbar.',
  },
];

const ENTRANCE: Readonly<Record<string, readonly Quantity[]>> = {
  'Ti50+Cf249': [MASS_EXCESS_AME2020.Ti50, MASS_EXCESS_AME2020.Cf249],
  'Ti50+Pu244': [MASS_EXCESS_AME2020.Ti50, MASS_EXCESS_AME2020.Pu244],
};

export interface QValueComparison {
  readonly modelId: string;
  readonly label: string;
  readonly source: SourceId;
  readonly qValue_MeV: number;
  readonly note?: string;
}

/** Q-Werte einer Reaktion nach allen Massenmodellen, die den Compoundkern enthalten. */
export function qValuesFromMassTables(reactionId: string): QValueComparison[] {
  const entrance = ENTRANCE[reactionId];
  if (!entrance) throw new Error(`Keine Massen für ${reactionId}`);
  const sum = entrance.reduce((s, m) => s + m.value, 0);
  const out: QValueComparison[] = [];
  for (const m of COMPOUND_MASS_MODELS) {
    const compound = m.massExcess_MeV[reactionId];
    if (compound === undefined) continue;
    out.push({
      modelId: m.id,
      label: m.label,
      source: m.source,
      qValue_MeV: sum - compound,
      ...(m.note === undefined ? {} : { note: m.note }),
    });
  }
  return out;
}
