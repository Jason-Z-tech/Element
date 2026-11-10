import { q } from './sources';

/** Avogadro-Konstante, exakt seit SI 2019. */
export const AVOGADRO = q(6.02214076e23, '1/mol', 'definition', 'codata2018');

/** e²/(4πε0) in MeV·fm. */
export const E2_MEV_FM = q(1.43996448, 'MeV fm', 'gemessen', 'codata2018');

/** 1 Femtobarn in cm². */
export const FB_IN_CM2 = 1e-39;

/** Sekunden pro Tag. */
export const SECONDS_PER_DAY = 86400;

/**
 * Eichfaktor der Rate auf das Berkeley-Experiment (50Ti + 244Pu, 2024):
 * im Mittel 2 Ketten in 22,1 Tagen bei 440 fb. Fasst alles zusammen, was die
 * einfache Formel nicht einzeln beschreibt (Strahlzeit-Anteil, Energieverlust
 * im Target, Nachweis im Fokalebenen-Detektor, ...).
 */
export const BERKELEY_CALIBRATION = q(
  0.556,
  '',
  'eichung',
  'projectSpec',
  'Geeicht auf 2 Ketten in 22,1 Tagen (Gates et al. 2024).',
);

/** Standardwerte des Steuerpults. */
export const DEFAULTS = {
  beamPerSecond: q(6e12, '1/s', 'annahme', 'projectSpec', 'Standard-Strahlstärke (Projektvorgabe).'),
  targetThickness: q(0.44, 'mg/cm²', 'annahme', 'projectSpec', 'Standard-Targetdicke (Projektvorgabe).'),
  separatorEfficiency: q(0.7, '', 'annahme', 'projectSpec', 'Standard-Transmission des Separators (Projektvorgabe).'),
  /** Anteil der Alphas, die mit voller Energie gemessen werden; der Rest „entwischt“. */
  alphaFullEnergyFraction: q(0.9, '', 'annahme', 'projectSpec'),
  /** Zeitfenster, in dem die Glieder einer Kette liegen müssen. */
  chainWindow: q(1, 's', 'annahme', 'projectSpec'),
  /** Breite (Standardabweichung) der Gauß-Anregungsfunktionen. */
  excitationWidth: q(
    4,
    'MeV',
    'annahme',
    'projectSpec',
    '„Breite 4 MeV“ wird als Standardabweichung gelesen (Halbwertsbreite 9,4 MeV).',
  ),
} as const;

/** Berkeley-Messzeit, auf die geeicht wird. */
export const BERKELEY_RUN = {
  days: q(22.1, 'd', 'gemessen', 'gates2024'),
  chains: q(2, '', 'gemessen', 'gates2024'),
  eStar: q(41, 'MeV', 'gemessen', 'gates2024'),
} as const;
