import type { Provenance, SourceId } from './sources';

/**
 * Zerfallsdaten. Zeiten sind Halbwertszeiten in Sekunden (so stehen sie in der
 * Literatur); die Simulation zieht daraus exponentiell verteilte Zerfallszeiten
 * mit mittlerer Lebensdauer T½ / ln 2.
 */
export type DecayMode =
  | {
      readonly type: 'alpha';
      /** Verzweigungsanteil, Summe aller Zweige = 1. */
      readonly probability: number;
      /** Alpha-Energie in MeV; `null` = in der Vorgabe nicht angegeben (offen). */
      readonly energy_MeV: number | null;
      readonly daughter: string;
    }
  | {
      /** Spontane Spaltung, beendet die Kette. */
      readonly type: 'sf';
      readonly probability: number;
    };

export interface NuclideDecay {
  readonly id: string;
  readonly z: number;
  readonly a: number;
  readonly halfLife_s: number;
  readonly kind: Extract<Provenance, 'gemessen' | 'schaetzung' | 'vorhersage'>;
  readonly source: SourceId;
  /**
   * Zerfallszweige. Leer = die Kette wird hier abgeschnitten (Kern lebt viel
   * länger als das Zeitfenster, oder seine Zerfallsart ist offen).
   */
  readonly modes: readonly DecayMode[];
  readonly note?: string;
}

const ms = 1e-3;
const us = 1e-6;

const TABLE: readonly NuclideDecay[] = [
  // --- gemessen -----------------------------------------------------------
  {
    id: '290Lv',
    z: 116,
    a: 290,
    halfLife_s: 8.2 * ms,
    kind: 'gemessen',
    source: 'gates2024',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 10.84, daughter: '286Fl' }],
    note: 'Gates et al., Tabelle II (Zusatzmaterial): T½ = 8,2 (+3,2 −1,8) ms, E_alpha = 10,84(7) MeV.',
  },
  {
    id: '286Fl',
    z: 114,
    a: 286,
    halfLife_s: 106 * ms,
    kind: 'gemessen',
    source: 'gates2024',
    modes: [
      { type: 'alpha', probability: 31 / 56, energy_MeV: 10.18, daughter: '282Cn' },
      { type: 'alpha', probability: 1 / 56, energy_MeV: 9.57, daughter: '282Cn' },
      { type: 'sf', probability: 24 / 56 },
    ],
    note: 'Gates et al., Tabelle II (56 Ereignisse aus allen Experimenten): T½ = 106 (+17 −13) ms; Alpha 10,18(2) MeV 31/56, Alpha 9,57(3) MeV 1/56, Spaltung 24/56 = 43 %.',
  },
  {
    id: '282Cn',
    z: 112,
    a: 282,
    halfLife_s: 0.88 * ms,
    kind: 'gemessen',
    source: 'gates2024',
    modes: [{ type: 'sf', probability: 1 }],
    note: 'Gates et al., Tabelle II: T½ = 0,88 (+0,19 −0,13) ms, Spaltung.',
  },
  {
    id: '288Lv',
    z: 116,
    a: 288,
    halfLife_s: 2.0 * ms,
    kind: 'gemessen',
    source: 'oganessian2025Lv',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.08, daughter: '284Fl' }],
    note: 'Ackermann (2025), Tabelle 5.1: T½ = 2,0 (+2,3 −0,7) ms, Q_alpha = 11,240(15) MeV, also E_alpha = 11,08 MeV. Nur wenige Atome gemessen.',
  },
  {
    id: '284Fl',
    z: 114,
    a: 284,
    halfLife_s: 2.5 * ms,
    kind: 'gemessen',
    source: 'oganessian2025Lv',
    modes: [
      { type: 'alpha', probability: 0.24, energy_MeV: 10.57, daughter: '280Cn' },
      { type: 'sf', probability: 0.76 },
    ],
    note: 'Ackermann (2025), Tabelle 5.1: T½ = 2,5 (+1,2 −0,6) ms, Alpha / Spaltung = 24 / 76, Q_alpha = 10,721(17) MeV, also E_alpha = 10,57 MeV.',
  },
  {
    id: '280Cn',
    z: 112,
    a: 280,
    halfLife_s: 10 * us,
    kind: 'gemessen',
    source: 'oganessian2025Lv',
    modes: [{ type: 'sf', probability: 1 }],
    note: 'Ackermann (2025), Tabelle 5.1: T½ = 10 (+108 −4) µs, Spaltung. Entdeckt 2025.',
  },
  {
    id: '275Ds',
    z: 110,
    a: 275,
    halfLife_s: 0.43 * ms,
    kind: 'gemessen',
    source: 'oganessian2024Ds',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.2, daughter: '271Hs' }],
    note: 'Ackermann (2025), Tabelle 5.1: T½ = 0,43 (+0,29 −0,12) ms, Q_alpha = 11,370(20) MeV, also E_alpha = 11,20 MeV.',
  },
  {
    id: '271Hs',
    z: 108,
    a: 271,
    halfLife_s: 46,
    kind: 'gemessen',
    source: 'oganessian2024Ds',
    modes: [],
    note: 'Ackermann (2025), Tabelle 5.1: zwei Zustände, 7,1 (+8,4 −2,5) s und 46 (+56 −16) s, beide Alpha. Beide leben viel länger als das Zeitfenster von 1 s: Die Kette wird hier abgeschnitten.',
  },
  // --- geschätzt (Viola-Seaborg, Projektvorgabe), nur Alpha-Zerfall angenommen
  {
    id: '295-120',
    z: 120,
    a: 295,
    halfLife_s: 12 * us,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 12.82, daughter: '291Og' }],
  },
  {
    id: '291Og',
    z: 118,
    a: 291,
    halfLife_s: 0.2 * ms,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.98, daughter: '287Lv' }],
  },
  {
    id: '287Lv',
    z: 116,
    a: 287,
    halfLife_s: 1.5 * ms,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.19, daughter: '283Fl' }],
  },
  {
    id: '283Fl',
    z: 114,
    a: 283,
    halfLife_s: 10 * ms,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 10.7, daughter: '279Cn' }],
  },
  {
    id: '279Cn',
    z: 112,
    a: 279,
    halfLife_s: 5 * ms,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 10.84, daughter: '275Ds' }],
  },
  {
    id: '296-120',
    z: 120,
    a: 296,
    halfLife_s: 9 * us,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 12.73, daughter: '292Og' }],
  },
  {
    id: '292Og',
    z: 118,
    a: 292,
    halfLife_s: 0.18 * ms,
    kind: 'schaetzung',
    source: 'violaSeaborg',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.89, daughter: '288Lv' }],
  },
  // --- vorhergesagt (Saxena et al. 2021, Tabelle 6): Kette des 5n-Kanals -----
  // E_alpha = Q_alpha · (A − 4) / A, T½ = 10^(log10 T½ der Formel QF).
  {
    id: '294-120',
    z: 120,
    a: 294,
    halfLife_s: Math.pow(10, -5.46),
    kind: 'vorhersage',
    source: 'saxena2021',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 13.06, daughter: '290Og' }],
    note: 'Q_alpha = 13,24 MeV (WS4), log10 T½ = −5,46: T½ = 3,5 µs.',
  },
  {
    id: '290Og',
    z: 118,
    a: 290,
    halfLife_s: Math.pow(10, -4.71),
    kind: 'vorhersage',
    source: 'saxena2021',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 12.43, daughter: '286Lv' }],
    note: 'Q_alpha = 12,60 MeV (WS4), log10 T½ = −4,71: T½ = 19 µs.',
  },
  {
    id: '286Lv',
    z: 116,
    a: 286,
    halfLife_s: Math.pow(10, -2.45),
    kind: 'vorhersage',
    source: 'saxena2021',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.15, daughter: '282Fl' }],
    note: 'Q_alpha = 11,31 MeV (WS4), log10 T½ = −2,45: T½ = 3,5 ms.',
  },
  {
    id: '282Fl',
    z: 114,
    a: 282,
    halfLife_s: Math.pow(10, -3.17),
    kind: 'vorhersage',
    source: 'saxena2021',
    modes: [],
    note: 'Zerfallsart offen: Saxena et al. sagen Alpha vorher (T½ = 0,7 ms), die gemessenen Nachbarn 284Fl und 282Cn spalten aber überwiegend. Die Kette wird hier abgeschnitten.',
  },
];

export const DECAYS: ReadonlyMap<string, NuclideDecay> = new Map(TABLE.map((n) => [n.id, n]));

export function getDecay(id: string): NuclideDecay {
  const n = DECAYS.get(id);
  if (!n) throw new Error(`Keine Zerfallsdaten für ${id}`);
  return n;
}
