import { DEFAULTS } from './constants';
import { q, type Quantity } from './sources';

export interface Nucleus {
  readonly symbol: string;
  readonly z: number;
  readonly a: number;
}

/** Ein Verdampfungskanal (xn): Der Compoundkern dampft x Neutronen ab. */
export interface Channel {
  readonly neutrons: number;
  /** Maximum der Anregungsfunktion. */
  readonly sigmaMax: Quantity;
  /** Anregungsenergie am Maximum. */
  readonly eStarPeak: Quantity;
  /** Breite (Standardabweichung) der Gauß-Kurve. */
  readonly width: Quantity;
  /**
   * Erzeugter Kern (Start der Zerfallskette). `null` = für diese Kette gibt es
   * keine Zerfallsdaten: offen, wird nicht simuliert.
   */
  readonly residue: string | null;
  readonly residueLabel: string;
}

export interface Reaction {
  readonly id: string;
  readonly label: string;
  readonly projectile: Nucleus;
  readonly target: Nucleus;
  readonly compound: Nucleus;
  /** Q-Wert der Fusion in MeV (negativ). */
  readonly qValue: Quantity;
  readonly channels: readonly Channel[];
  /** Kommt die Anregungsfunktion aus einer Messung oder einer Vorhersage? */
  readonly basis: 'gemessen' | 'vorhersage';
  readonly note: string;
}

const width = DEFAULTS.excitationWidth;

export const REACTIONS = {
  'Ti50+Pu244': {
    id: 'Ti50+Pu244',
    label: '⁵⁰Ti + ²⁴⁴Pu → Element 116 (Livermorium)',
    projectile: { symbol: 'Ti', z: 22, a: 50 },
    target: { symbol: 'Pu', z: 94, a: 244 },
    compound: { symbol: 'Lv', z: 116, a: 294 },
    qValue: q(
      -179.0,
      'MeV',
      'schaetzung',
      'gates2024',
      'Aus E_cm = 220(3) MeV und E* = 41(2) MeV bei Gates et al. (Thomas-Fermi-Massentabelle von Myers und Swiatecki).',
    ),
    basis: 'gemessen',
    note: 'Testlauf: echtes Berkeley-Experiment 2024. Gemessen wurde nur bei einer Energie; die Form der Kurve (Gauß, Breite 4 MeV) ist eine Annahme.',
    channels: [
      {
        neutrons: 4,
        sigmaMax: q(440, 'fb', 'gemessen', 'gates2024', '0,44 (+0,58 −0,28) pb, 2 Ketten.'),
        eStarPeak: q(41, 'MeV', 'gemessen', 'gates2024', 'Energie der Messung; als Maximum angenommen.'),
        width,
        residue: '290Lv',
        residueLabel: '²⁹⁰Lv',
      },
    ],
  },
  'Ti50+Cf249': {
    id: 'Ti50+Cf249',
    label: '⁵⁰Ti + ²⁴⁹Cf → Element 120',
    projectile: { symbol: 'Ti', z: 22, a: 50 },
    target: { symbol: 'Cf', z: 98, a: 249 },
    compound: { symbol: '120', z: 120, a: 299 },
    qValue: q(-197.7, 'MeV', 'schaetzung', 'projectSpec', 'Abschätzung, ±3 MeV. Zhang et al. nennen keinen Q-Wert; Massentabelle noch offen.'),
    basis: 'vorhersage',
    note: 'Hauptreaktion. Element 120 wurde noch nie gemessen; alle Trefferquoten sind Vorhersagen.',
    channels: [
      {
        neutrons: 3,
        sigmaMax: q(12.87, 'fb', 'vorhersage', 'prediction120'),
        eStarPeak: q(34, 'MeV', 'vorhersage', 'prediction120'),
        width,
        residue: '296-120',
        residueLabel: '²⁹⁶120',
      },
      {
        neutrons: 4,
        sigmaMax: q(48.2, 'fb', 'vorhersage', 'prediction120'),
        eStarPeak: q(41, 'MeV', 'vorhersage', 'prediction120'),
        width,
        residue: '295-120',
        residueLabel: '²⁹⁵120',
      },
      {
        neutrons: 5,
        sigmaMax: q(9.9, 'fb', 'vorhersage', 'prediction120'),
        eStarPeak: q(52, 'MeV', 'vorhersage', 'prediction120'),
        width,
        residue: '294-120',
        residueLabel: '²⁹⁴120',
      },
    ],
  },
} as const satisfies Record<string, Reaction>;

export type ReactionId = keyof typeof REACTIONS;

export function getReaction(id: string): Reaction {
  const r = (REACTIONS as Record<string, Reaction>)[id];
  if (!r) throw new Error(`Unbekannte Reaktion ${id}`);
  return r;
}
