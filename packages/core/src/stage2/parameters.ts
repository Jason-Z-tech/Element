import type { ModelParameters } from './model';

/** Kennung des Modells von Stufe 2. Ändert sich bei jeder Änderung an Formeln, Tabellen oder Eichung. */
export const STAGE2_MODEL_VERSION = 'stufe2-v1';

/**
 * Eingefrorener Parametersatz. `sInjA_fm` und `sInjB_fmPerMeV` sind die einzigen
 * geeichten Größen (scripts/stage2-eichung.ts, 400 Kaskaden je Drehimpuls, Seed 20261110,
 * 48 Messpunkte aus 48Ca + 238U, 242Pu, 243Am, 248Cm, 249Bk).
 */
export const STAGE2_PARAMETERS: ModelParameters = {
  sInjA_fm: 4.28,
  sInjB_fmPerMeV: 0.011,
  orientationDependentInjection: true,
  potential: { kind: 'bass' },
  nTheta: 24,
  barrierCoefficients: 'fbd2011',
};

/** Ergebnis der Eichung, zur Anzeige. */
export const CALIBRATION_SUMMARY = {
  points: 48,
  chi2: 530.8,
  /** Streuung Rechnung gegen Messung an den Eich-Punkten als Faktor (quadratisches Mittel der Logarithmen). */
  scatterFactor: 8.9,
  /** Mittlere Abweichung als Faktor (Rechnung / Messung). */
  meanFactor: 0.57,
  /** Streuung des Einschuss-Abstands, mit dem jede Messung genau getroffen würde, in fm. */
  sInjScatter_fm: 1.02,
  date: '2026-11-10',
} as const;

/**
 * Breiten der Zufallsziehungen im Unsicherheits-Ensemble (je eine Standardabweichung
 * einer Normalverteilung) mit Begründung.
 */
export const UNCERTAINTIES = {
  fissionBarrier_MeV: {
    sigma: 0.5,
    kind: 'belegt',
    reason:
      'Siwek-Wilczyńska et al., Phys. Rev. C 86, 014611 (2012): Genauigkeit einzelner Spaltbarrieren kaum besser als ±0,5 MeV; Kowal et al., arXiv:1607.08462: mittlere Abweichung 0,5 MeV bei gemessenen Barrieren. Annahme: Die Fehler benachbarter Kerne sind unabhängig.',
  },
  injectionDistance_fm: {
    sigma: 0.6,
    kind: 'belegt',
    reason:
      'Rest-Streuung aus der eigenen Eichung. An den 48 Eich-Punkten streut Rechnung gegen Messung um einen Faktor 8,9 (0,95 Dekaden). Spaltbarrieren, Q-Wert und Einfang-Barriere erklären zusammen etwa 0,72 Dekaden; der Rest (0,62 Dekaden) entspricht 0,6 fm im Einschuss-Abstand. Die volle Streuung des Einschuss-Abstands (1,02 fm; Cap et al. 2022 nennen ±1 fm) enthält die anderen Beiträge schon und würde sie doppelt zählen.',
  },
  qValue_MeV: {
    sigma: 2.1,
    kind: 'belegt',
    reason:
      'Standardabweichung der Q-Werte von 50Ti + 249Cf aus vier Massenmodellen (FRDM 2012, FRLDM 2012, Jachimowicz–Kowal–Skalski 2021, WS4-Kette). Annahme: Dieselbe Breite gilt für alle Reaktionen. Die Festlegung ±3 MeV aus Stufe 1 entspricht 1,4 Standardabweichungen.',
  },
  captureBarrier_MeV: {
    sigma: 2.0,
    kind: 'annahme',
    reason:
      'Annahme. Anhaltspunkte: Cap et al. (2022) finden Unterschiede bis 2 MeV zwischen Systematik und gemessenen Barrierenverteilungen; unser Bass-Potential liegt für 48Ca + 248Cm 2 bis 4 MeV unter Haginos Potential, das an eine gemessene Barrierenverteilung angepasst ist.',
  },
} as const;
