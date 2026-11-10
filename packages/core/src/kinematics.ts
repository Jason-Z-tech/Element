import { E2_MEV_FM } from './data/constants';

/** Schwerpunktsenergie: E_cm = E_lab * A_Target / (A_Projektil + A_Target). */
export function eCmFromLab(eLab_MeV: number, aProjectile: number, aTarget: number): number {
  return (eLab_MeV * aTarget) / (aProjectile + aTarget);
}

/** Umkehrung: E_lab = E_cm * (A_Projektil + A_Target) / A_Target. */
export function eLabFromCm(eCm_MeV: number, aProjectile: number, aTarget: number): number {
  return (eCm_MeV * (aProjectile + aTarget)) / aTarget;
}

/** Anregungsenergie des Compoundkerns: E* = E_cm + Q. */
export function excitationEnergy(eCm_MeV: number, q_MeV: number): number {
  return eCm_MeV + q_MeV;
}

/** Radius im Bass-Modell: R = 1,16 A^(1/3) - 1,39 A^(-1/3) fm. */
export function bassRadius_fm(a: number): number {
  const a13 = Math.cbrt(a);
  return 1.16 * a13 - 1.39 / a13;
}

/**
 * Kern-Kern-Potential nach Bass (Phys. Rev. Lett. 39, 265 (1977)):
 *   V(r) = Z1 Z2 e² / r - R1 R2 / (R1 + R2) * g(s),   s = r - R1 - R2,
 *   g(s) = 1 / (0,0300 exp(s / 3,30 fm) + 0,0061 exp(s / 0,65 fm))  [MeV/fm].
 */
export function bassPotential_MeV(
  r_fm: number,
  z1: number,
  a1: number,
  z2: number,
  a2: number,
): number {
  const r1 = bassRadius_fm(a1);
  const r2 = bassRadius_fm(a2);
  const s = r_fm - r1 - r2;
  const g = 1 / (0.03 * Math.exp(s / 3.3) + 0.0061 * Math.exp(s / 0.65));
  return (z1 * z2 * E2_MEV_FM.value) / r_fm - ((r1 * r2) / (r1 + r2)) * g;
}

export interface BassBarrier {
  /** Höhe der Barriere in MeV. */
  readonly height_MeV: number;
  /** Abstand der Kernmittelpunkte am Barrierenmaximum in fm. */
  readonly radius_fm: number;
}

/**
 * Bass-Barriere: Maximum von V(r) außerhalb des Berührpunkts.
 * Erst grobes Abtasten, dann Verfeinern mit dem Goldenen Schnitt.
 */
export function bassBarrier(z1: number, a1: number, z2: number, a2: number): BassBarrier {
  const contact = bassRadius_fm(a1) + bassRadius_fm(a2);
  const v = (r: number): number => bassPotential_MeV(r, z1, a1, z2, a2);
  const step = 0.02;
  let bestR = contact;
  let bestV = v(contact);
  for (let r = contact; r <= contact + 8; r += step) {
    const value = v(r);
    if (value > bestV) {
      bestV = value;
      bestR = r;
    }
  }
  let lo = Math.max(contact, bestR - step);
  let hi = bestR + step;
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = v(x1);
  let f2 = v(x2);
  for (let i = 0; i < 60; i++) {
    if (f1 < f2) {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + phi * (hi - lo);
      f2 = v(x2);
    } else {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - phi * (hi - lo);
      f1 = v(x1);
    }
  }
  const radius = (lo + hi) / 2;
  return { height_MeV: v(radius), radius_fm: radius };
}
