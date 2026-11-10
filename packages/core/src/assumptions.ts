import { DEFAULTS } from './data/constants';
import type { Fl282Decay } from './data/decays';

/**
 * Einstellbare Annahmen von Stufe 1. Jede hat einen Standardwert und steht auf
 * der Methoden-Seite unter „Annahmen“.
 */
export interface Stage1Parameters {
  /** Zerfallsart von 282Fl am Ende der 5n-Kette von Element 120. */
  readonly fl282Decay: Fl282Decay;
  /** Breite (Standardabweichung) der Gauß-Anregungsfunktionen in MeV. */
  readonly excitationWidth_MeV: number;
  /**
   * Q-Wert in MeV, falls vom Standardwert der Reaktion abgewichen werden soll;
   * `null` = Standardwert der Reaktion.
   */
  readonly qValue_MeV: number | null;
}

export const DEFAULT_PARAMETERS: Stage1Parameters = {
  fl282Decay: 'sf',
  excitationWidth_MeV: DEFAULTS.excitationWidth.value,
  qValue_MeV: null,
};

export interface Assumption {
  readonly id: keyof Stage1Parameters;
  readonly title: string;
  readonly standard: string;
  readonly text: string;
}

/** Texte für die Methoden-Seite, Abschnitt „Annahmen“. */
export const ASSUMPTIONS: readonly Assumption[] = [
  {
    id: 'fl282Decay',
    title: 'Zerfall von ²⁸²Fl',
    standard: 'Spontanspaltung',
    text: '²⁸²Fl, das Ende der 5n-Kette von Element 120, wurde noch nie gemessen. Angenommen wird Spontanspaltung, weil die gemessenen Nachbarn ²⁸⁴Fl und ²⁸²Cn überwiegend spalten. Eine veröffentlichte Vorhersage (Saxena et al., arXiv:2107.12976) nennt Alpha-Zerfall; darauf lässt sich umstellen. Die Halbwertszeit (0,7 ms) ist ein Platzhalter aus dieser Vorhersage.',
  },
  {
    id: 'qValue_MeV',
    title: 'Q-Wert von ⁵⁰Ti + ²⁴⁹Cf',
    standard: '−197,7 MeV ± 3 MeV',
    text: 'Die Masse des Compoundkerns ²⁹⁹120 ist nicht gemessen. Massentabellen ergeben −194,8 MeV (FRDM 2012), −198,6 MeV (Jachimowicz–Kowal–Skalski 2021), −199,0 MeV (WS4-Alpha-Kette an AME2020) und −199,3 MeV (FRLDM 2012). Der Q-Wert legt fest, welche Strahlenergie zu welcher Anregungsenergie gehört: 3 MeV Unsicherheit verschieben die beste Strahlenergie um 3,6 MeV.',
  },
  {
    id: 'excitationWidth_MeV',
    title: 'Form der Anregungsfunktion',
    standard: 'Gauß-Kurve, Breite 4 MeV',
    text: 'Belegt sind nur die Maxima der Trefferquote und ihre Energien. Dass die Kurve eine Gauß-Kurve mit 4 MeV Breite (Standardabweichung) ist, ist eine Annahme für Stufe 1. Stufe 2 ersetzt sie durch die eigene Rechnung.',
  },
];
