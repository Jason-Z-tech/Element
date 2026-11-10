import { describe, expect, it } from 'vitest';
import {
  bassBarrier,
  eCmFromLab,
  eLabForExcitation,
  eLabFromCm,
  excitationEnergy,
  excitationForELab,
  REACTIONS,
} from '../src';

describe('Kinematik', () => {
  it('E_cm = E_lab * A_Target / (A_Projektil + A_Target)', () => {
    expect(eCmFromLab(294, 50, 244)).toBeCloseTo(244, 10);
    expect(eLabFromCm(eCmFromLab(265, 50, 249), 50, 249)).toBeCloseTo(265, 10);
  });

  it('E* = E_cm + Q', () => {
    expect(excitationEnergy(220, -179.0)).toBeCloseTo(41, 10);
  });

  it('Berkeley: E* = 41 MeV entspricht E_cm = 220 MeV und E_lab = 265,1 MeV', () => {
    const eLab = eLabForExcitation('Ti50+Pu244', 41);
    expect(eLab).toBeCloseTo(265.08, 2);
    expect(eCmFromLab(eLab, 50, 244)).toBeCloseTo(220, 10);
    expect(excitationForELab('Ti50+Pu244', eLab)).toBeCloseTo(41, 10);
  });

  it('Q-Werte wie vorgegeben', () => {
    expect(REACTIONS['Ti50+Pu244'].qValue.value).toBe(-179.0);
    expect(REACTIONS['Ti50+Cf249'].qValue.value).toBe(-197.7);
  });
});

describe('Bass-Barriere (Bass 1977)', () => {
  it('50Ti + 249Cf: 226,2 MeV', () => {
    expect(bassBarrier(22, 50, 98, 249).height_MeV).toBeCloseTo(226.2, 1);
  });

  it('50Ti + 244Pu: 217,2 MeV', () => {
    // Die Formel liefert 217,25; die Vorgabe nennt 217,2.
    const b = bassBarrier(22, 50, 94, 244);
    expect(Math.abs(b.height_MeV - 217.2)).toBeLessThan(0.06);
    expect(b.radius_fm).toBeGreaterThan(12);
    expect(b.radius_fm).toBeLessThan(13.5);
  });

  it('ist symmetrisch in Projektil und Target', () => {
    expect(bassBarrier(98, 249, 22, 50).height_MeV).toBeCloseTo(
      bassBarrier(22, 50, 98, 249).height_MeV,
      9,
    );
  });
});
