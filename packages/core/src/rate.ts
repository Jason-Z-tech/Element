import { AVOGADRO, BERKELEY_CALIBRATION, FB_IN_CM2 } from './data/constants';

/**
 * Targetkerne pro cm² aus der Flächendichte.
 * Näherung: molare Masse = Massenzahl in g/mol (Fehler < 0,1 %); die Dicke
 * bezieht sich auf das reine Isotop.
 */
export function targetNucleiPerCm2(thickness_mg_cm2: number, aTarget: number): number {
  return ((thickness_mg_cm2 * 1e-3) / aTarget) * AVOGADRO.value;
}

export interface BeamSetup {
  readonly beamPerSecond: number;
  readonly thickness_mg_cm2: number;
  readonly aTarget: number;
  readonly separatorEfficiency: number;
}

/**
 * Empfindlichkeit: erwartete Kerne hinter dem Separator pro Sekunde und pro fb.
 *   Rate = Wirkungsquerschnitt * Targetkerne/cm² * Strahlkerne/s * 0,556 * Separator
 */
export function sensitivityPerSecondPerFb(setup: BeamSetup): number {
  return (
    FB_IN_CM2 *
    targetNucleiPerCm2(setup.thickness_mg_cm2, setup.aTarget) *
    setup.beamPerSecond *
    BERKELEY_CALIBRATION.value *
    setup.separatorEfficiency
  );
}

/** Rate in 1/s für einen Wirkungsquerschnitt in fb. */
export function ratePerSecond(sigma_fb: number, setup: BeamSetup): number {
  return sigma_fb * sensitivityPerSecondPerFb(setup);
}
