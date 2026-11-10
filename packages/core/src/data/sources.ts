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
  ackermann2025: {
    ref: 'D. Ackermann, „Decay spectroscopy of heavy and superheavy nuclei“, arXiv:2501.04053v7 (2025), Tabelle 5.1',
    checked: true,
    note: 'Übersichtsarbeit, am arXiv-Volltext geprüft (10.11.2026). Tabelle der Zerfallsdaten aller bekannten Isotope von Z = 99 bis 118; die Spalte nennt Q_alpha, daraus E_alpha = Q_alpha · (A − 4) / A.',
  },
  oganessian2024Ds: {
    ref: 'Yu. Ts. Oganessian et al., „Synthesis and decay properties of isotopes of element 110: 273Ds and 275Ds“, Phys. Rev. C 109, 054307 (2024)',
    checked: false,
    note: 'Original nicht abrufbar; Werte über Ackermann (2025), Tabelle 5.1, geprüft.',
  },
  oganessian2025Lv: {
    ref: 'Yu. Ts. Oganessian et al., „Investigation of reactions with 50Ti and 54Cr for the synthesis of new elements“, Phys. Rev. C 112, 014603 (2025)',
    checked: false,
    note: 'Original nicht abrufbar; Werte über Ackermann (2025), Tabelle 5.1, geprüft.',
  },
  saxena2021: {
    ref: 'G. Saxena, A. Jain, P. K. Sharma, „A new empirical formula for α-decay half-life and decay chains of Z=120 isotopes“, arXiv:2107.12976 (2021), Tabelle 6',
    checked: true,
    note: 'Am arXiv-Volltext geprüft (10.11.2026). Vorhersage: Q_alpha aus dem Massenmodell WS4, Halbwertszeit aus der Formel „QF“ der Arbeit. Die dort vorhergesagten Spaltungs-Halbwertszeiten verfehlen die gemessenen Nachbarn 284Fl und 282Cn um viele Größenordnungen und werden nicht verwendet.',
  },
  ame2020: {
    ref: 'M. Wang, W. J. Huang, F. G. Kondev, G. Audi, S. Naimi, „The AME 2020 atomic mass evaluation (II)“, Chin. Phys. C 45, 030003 (2021); Datei mass_1.mas20 (IAEA, www-nds.iaea.org/amdc)',
    checked: true,
    note: 'An der Originaldatei geprüft (10.11.2026).',
  },
  frdm2012: {
    ref: 'P. Möller, A. J. Sierk, T. Ichikawa, H. Sagawa, „Nuclear ground-state masses and deformations: FRDM(2012)“, arXiv:1508.06294 (2015); At. Data Nucl. Data Tables 109–110, 1 (2016)',
    checked: true,
    note: 'Massentabelle am arXiv-Volltext geprüft (10.11.2026). Spalten M_th (FRDM) und M_th^FL (FRLDM).',
  },
  jks2021: {
    ref: 'P. Jachimowicz, M. Kowal, J. Skalski, „Properties of heaviest nuclei with 98 ≤ Z ≤ 126 and 134 ≤ N ≤ 192“, arXiv:2010.10018 (2020); At. Data Nucl. Data Tables 138, 101393 (2021)',
    checked: true,
    note: 'Warschauer mikroskopisch-makroskopisches Modell. Tabelle 1 am arXiv-Volltext geprüft (10.11.2026).',
  },
  ws4: {
    ref: 'N. Wang, M. Liu, X. Wu, J. Meng, „Surface diffuseness correction in global mass formula“, Phys. Lett. B 734, 215 (2014) (WS4)',
    checked: false,
    note: 'Die WS4-Tabelle selbst war nicht abrufbar. Verwendet werden die WS4-Werte für Q_alpha, wie sie Saxena et al. (arXiv:2107.12976), Tabelle 7, abdrucken.',
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
