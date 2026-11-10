/**
 * PFLICHT-TEST: Eichung auf das Berkeley-Experiment.
 * 50Ti + 244Pu -> 290Lv + 4n, 440 fb bei E* = 41 MeV: im Mittel 2 Ketten in 22,1 Tagen
 * (Gates et al., Phys. Rev. Lett. 133, 172502 (2024); arXiv:2407.16079).
 */
import { describe, expect, it } from 'vitest';
import {
  BERKELEY_CALIBRATION,
  BERKELEY_RUN,
  chainEfficiency,
  DEFAULTS,
  eLabForExcitation,
  getReaction,
  publishedNature,
  ratePerSecond,
  runExperiment,
  SECONDS_PER_DAY,
  targetNucleiPerCm2,
  type RunSettings,
} from '../src';

const reaction = getReaction('Ti50+Pu244');
const nature = publishedNature(reaction);
const beamTime_s = BERKELEY_RUN.days.value * SECONDS_PER_DAY;

const berkeley = (seed: number): RunSettings => ({
  reactionId: 'Ti50+Pu244',
  eLab_MeV: eLabForExcitation('Ti50+Pu244', BERKELEY_RUN.eStar.value),
  beamPerSecond: DEFAULTS.beamPerSecond.value,
  thickness_mg_cm2: DEFAULTS.targetThickness.value,
  beamTime_s,
  seed,
});

describe('Berkeley-Eichung (Pflicht-Test)', () => {
  it('Standardwerte wie vorgegeben', () => {
    expect(DEFAULTS.beamPerSecond.value).toBe(6e12);
    expect(DEFAULTS.targetThickness.value).toBe(0.44);
    expect(DEFAULTS.separatorEfficiency.value).toBe(0.7);
    expect(BERKELEY_CALIBRATION.value).toBe(0.556);
  });

  it('Targetkerne: 0,44 mg/cm² 244Pu = 1,086e18 Kerne/cm²', () => {
    expect(targetNucleiPerCm2(0.44, 244) / 1e18).toBeCloseTo(1.086, 3);
  });

  it('Rate = sigma * Targetkerne * Strahl * 0,556 * 0,70', () => {
    const rate = ratePerSecond(440, {
      beamPerSecond: 6e12,
      thickness_mg_cm2: 0.44,
      aTarget: 244,
      separatorEfficiency: 0.7,
    });
    const byHand = 440e-39 * ((0.44e-3 / 244) * 6.02214076e23) * 6e12 * 0.556 * 0.7;
    expect(rate).toBeCloseTo(byHand, 20);
    expect(rate / byHand).toBeCloseTo(1, 12);
  });

  it('Erwartung: 2 Ketten in 22,1 Tagen', () => {
    const rate = ratePerSecond(440, {
      beamPerSecond: 6e12,
      thickness_mg_cm2: 0.44,
      aTarget: 244,
      separatorEfficiency: 0.7,
    });
    const implanted = rate * beamTime_s; // Kerne hinter dem Separator
    const chains = implanted * chainEfficiency('290Lv'); // nach der Zählregel erkannte Ketten
    expect(implanted).toBeCloseTo(2.13, 2);
    expect(chains).toBeGreaterThan(2.015);
    expect(chains).toBeLessThan(2.03);
    // Die Eichung gilt als bestanden, wenn die erkannten Ketten auf 2,5 % bei 2 liegen.
    expect(Math.abs(chains - BERKELEY_RUN.chains.value)).toBeLessThan(0.05);
  });

  it('Simulation: im Mittel 2 Ketten in 22,1 Tagen, Poisson-verteilt', () => {
    const runs = 20_000;
    let sum = 0;
    let sum2 = 0;
    let zero = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const n = runExperiment(berkeley(seed), nature).analysis.chains;
      sum += n;
      sum2 += n * n;
      if (n === 0) zero++;
    }
    const mean = sum / runs;
    const variance = sum2 / runs - mean * mean;
    // Standardfehler des Mittels: sqrt(2,02 / 20000) = 0,010
    expect(Math.abs(mean - 2)).toBeLessThan(0.06);
    expect(Math.abs(mean - 2.024)).toBeLessThan(0.04);
    expect(variance / mean).toBeGreaterThan(0.95);
    expect(variance / mean).toBeLessThan(1.05);
    // Anteil der Messzeiten ganz ohne Kette: exp(-2,02) = 13 %
    expect(zero / runs).toBeCloseTo(Math.exp(-2.024), 2);
  });

  it('Auswertung: 2 Ketten ergeben 0,44 (+0,58 −0,28) pb wie veröffentlicht', () => {
    let seed = 1;
    let result = runExperiment(berkeley(seed), nature);
    while (result.analysis.chains !== 2) result = runExperiment(berkeley(++seed), nature);
    const a = result.analysis;
    expect(result.eStar_MeV).toBeCloseTo(41, 9);
    expect(result.eCm_MeV).toBeCloseTo(220, 9);
    // 2 % Toleranz: Eichfaktor und Fehlergrenzen sind auf zwei Stellen gerundet veröffentlicht.
    expect(Math.abs(a.sigma_fb - 440) / 440).toBeLessThan(0.02);
    expect(Math.abs(a.errHigh_fb - 580) / 580).toBeLessThan(0.02);
    expect(Math.abs(a.errLow_fb - 280) / 280).toBeLessThan(0.02);
    expect(a.upperLimit_fb).toBeNull();
  });

  it('Auswertung ist im Mittel erwartungstreu: 440 fb', () => {
    const runs = 20_000;
    let sum = 0;
    for (let seed = 1; seed <= runs; seed++) sum += runExperiment(berkeley(seed), nature).analysis.sigma_fb;
    // Standardfehler: 440 / sqrt(2,02 * 20000) = 2,2 fb
    expect(Math.abs(sum / runs - 440)).toBeLessThan(9);
  });
});
