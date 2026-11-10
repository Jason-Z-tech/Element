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
  readonly kind: Extract<Provenance, 'gemessen' | 'schaetzung'>;
  readonly source: SourceId;
  /**
   * Zerfallszweige. Leer = die Kette wird hier abgeschnitten (langlebiger Kern,
   * Zerfallsart in der Vorgabe nicht angegeben).
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
      { type: 'alpha', probability: 0.55, energy_MeV: 10.18, daughter: '282Cn' },
      { type: 'sf', probability: 0.45 },
    ],
    note: 'Gates et al., Tabelle II: T½ = 106 (+17 −13) ms, E_alpha = 10,18(2) MeV. Dort: Alpha 31/56 (10,18 MeV) plus 1/56 (9,57 MeV), Spaltung 24/56 = 43 %; die Projektvorgabe rundet auf 55 / 45.',
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
    source: 'projectSpec',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: null, daughter: '284Fl' }],
    note: 'Alpha-Energie in der Vorgabe nicht angegeben (offen). Alpha-Zerfall nach 284Fl folgt aus der Kette.',
  },
  {
    id: '284Fl',
    z: 114,
    a: 284,
    halfLife_s: 2.5 * ms,
    kind: 'gemessen',
    source: 'projectSpec',
    modes: [{ type: 'sf', probability: 1 }],
  },
  {
    id: '275Ds',
    z: 110,
    a: 275,
    halfLife_s: 0.43 * ms,
    kind: 'gemessen',
    source: 'projectSpec',
    modes: [{ type: 'alpha', probability: 1, energy_MeV: 11.2, daughter: '271Hs' }],
  },
  {
    id: '271Hs',
    z: 108,
    a: 271,
    halfLife_s: 46,
    kind: 'gemessen',
    source: 'projectSpec',
    modes: [],
    note: 'Langlebig (46 s) und Zerfallsart nicht angegeben: Die Kette wird hier abgeschnitten.',
  },
  // --- geschätzt (Viola-Seaborg), nur Alpha-Zerfall angenommen -------------
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
];

export const DECAYS: ReadonlyMap<string, NuclideDecay> = new Map(TABLE.map((n) => [n.id, n]));

export function getDecay(id: string): NuclideDecay {
  const n = DECAYS.get(id);
  if (!n) throw new Error(`Keine Zerfallsdaten für ${id}`);
  return n;
}
