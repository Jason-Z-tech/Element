/**
 * Quellenverzeichnis. Grundsatz 2: Jede Zahl im Code ist ein Messwert mit Quelle,
 * eine veröffentlichte Vorhersage mit Quelle oder als Annahme markiert.
 *
 * `checked` sagt, ob die Werte in diesem Projekt schon gegen die Originalarbeit
 * geprüft wurden. `false` heißt: Der Wert stammt aus der Projektvorgabe oder aus
 * dem Gedächtnis der Literatur, die Prüfung am Original steht noch aus.
 */
export type Provenance =
  /** im Experiment gemessen */
  | 'gemessen'
  /** veröffentlichte theoretische Vorhersage */
  | 'vorhersage'
  /** Abschätzung aus einer Systematik (z. B. Viola-Seaborg, Massentabelle) */
  | 'schaetzung'
  /** Annahme dieses Projekts, nicht belegt */
  | 'annahme'
  /** Eichfaktor, an einem Experiment festgemacht */
  | 'eichung'
  /** exakte Definition oder mit einer zitierten Formel berechnet */
  | 'definition';

export interface Source {
  readonly ref: string;
  /** Wurde der Wert in diesem Projekt gegen das Original geprüft? */
  readonly checked: boolean;
  readonly note?: string;
}

export const SOURCES = {
  gates2024: {
    ref: 'J. M. Gates, R. Orford, D. Rudolph et al., „Towards the Discovery of New Elements: Production of Livermorium (Z=116) with 50Ti“, arXiv:2407.16079 (2024); erschienen in Phys. Rev. Lett. 133, 172502 (2024)',
    checked: true,
    note: 'Am arXiv-Volltext geprüft (10.11.2026): 2 Ketten 290Lv, 0,44 (+0,58 −0,28) pb, E_cm 220(3) MeV, E* 41(2) MeV, 22,1 Tage, ≈ 6e12 Ionen/s, Target 0,435(40) mg/cm², Separator 70(7) %, Ketten-Nachweis ≈ 95 %. Die Zeitschriftenangabe steht nicht auf der arXiv-Seite und ist ungeprüft.',
  },
  prediction120: {
    ref: 'W. Zhang, S.-J. Zhang, P.-H. Chen, „Synthesis mechanism of superheavy element 120: a dinuclear system model approach with microscopic inputs“, arXiv:2604.09287 (2026), Tabelle II',
    checked: true,
    note: 'Am arXiv-Volltext geprüft (10.11.2026): 50Ti + 249Cf 3n 12,87 fb bei 34 MeV; 4n 48,20 fb bei 41 MeV; 5n 9,90 fb bei 52 MeV. Zweikern-Modell (DNS). Die Arbeit nennt keine Unsicherheiten und keine Kurvenbreite.',
  },
  schmidt1984: {
    ref: 'K.-H. Schmidt, C.-C. Sahm, K. Pielenz, H.-G. Clerc, „Some remarks on the error analysis in the case of poor statistics“, Z. Phys. A 316, 19 (1984)',
    checked: false,
    note: 'Von Gates et al. für die 68-%-Fehler zitiert. Original nicht abrufbar; unsere Grenzen (nach Gehrels) reproduzieren die veröffentlichten +0,58 −0,28 pb.',
  },
  bass1977: {
    ref: 'R. Bass, „Nucleus-Nucleus Potential Deduced from Experimental Fusion Cross Sections“, Phys. Rev. Lett. 39, 265 (1977)',
    checked: false,
    note: 'Formel und Parameter aus dem Gedächtnis der Literatur; reproduziert die vorgegebenen Barrieren 226,2 und 217,2 MeV.',
  },
  gehrels1986: {
    ref: 'N. Gehrels, „Confidence limits for small numbers of events in astrophysical data“, Astrophys. J. 303, 336 (1986)',
    checked: false,
    note: 'Poisson-Vertrauensgrenzen; Tabellenwerte in den Tests.',
  },
  codata2018: {
    ref: 'CODATA 2018 / SI 2019: N_A = 6,02214076e23 1/mol (exakt), e²/(4πε0) = 1,43996448 MeV fm',
    checked: false,
  },
  violaSeaborg: {
    ref: 'Abschätzung nach der Viola-Seaborg-Systematik (V. E. Viola, G. T. Seaborg, J. Inorg. Nucl. Chem. 28, 741 (1966)); Zahlenwerte aus der Projektvorgabe',
    checked: false,
    note: 'Schätzwerte, keine Messung. Verwendete Q_alpha-Werte und Parametersatz sind noch offen.',
  },
  projectSpec: {
    ref: 'Projektvorgabe (Auftraggeber). Originalquelle noch offen.',
    checked: false,
  },
  assumption: {
    ref: 'Annahme dieses Projekts, nicht durch eine Quelle belegt.',
    checked: false,
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/** Eine Zahl mit Einheit, Herkunft und Quelle. */
export interface Quantity {
  readonly value: number;
  readonly unit: string;
  readonly kind: Provenance;
  readonly source: SourceId;
  readonly note?: string;
}

export function q(
  value: number,
  unit: string,
  kind: Provenance,
  source: SourceId,
  note?: string,
): Quantity {
  return note === undefined ? { value, unit, kind, source } : { value, unit, kind, source, note };
}
