import { describe, expect, it } from 'vitest';
import {
  analyse,
  channelCrossSection_fb,
  combineRuns,
  CORE_VERSION,
  eLabForExcitation,
  findMaximum,
  getReaction,
  HIDDEN_NATURE,
  hiddenNature,
  publishedNature,
  runExperiment,
  SECONDS_PER_DAY,
  STAGE1_MODEL_VERSION,
  totalCrossSection_fb,
  type RunSettings,
} from '../src';

const r120 = getReaction('Ti50+Cf249');
const published = publishedNature(r120);

const settings = (eStar: number, seed: number, days = 100, beam = 6e12): RunSettings => ({
  reactionId: 'Ti50+Cf249',
  eLab_MeV: eLabForExcitation('Ti50+Cf249', eStar),
  beamPerSecond: beam,
  thickness_mg_cm2: 0.44,
  beamTime_s: days * SECONDS_PER_DAY,
  seed,
});

describe('Trefferquote Element 120 (Vorhersage)', () => {
  it('Maxima der Kanäle wie vorgegeben', () => {
    const [n3, n4, n5] = published.channels;
    expect(channelCrossSection_fb(n3!, 34)).toBeCloseTo(12.87, 12);
    expect(channelCrossSection_fb(n4!, 41)).toBeCloseTo(48.2, 12);
    expect(channelCrossSection_fb(n5!, 52)).toBeCloseTo(9.9, 12);
  });

  it('Gauß-Kurve mit Breite 4 MeV', () => {
    const n4 = published.channels[1]!;
    expect(channelCrossSection_fb(n4, 45) / 48.2).toBeCloseTo(Math.exp(-0.5), 12);
    expect(channelCrossSection_fb(n4, 37)).toBeCloseTo(channelCrossSection_fb(n4, 45), 12);
  });

  it('Summenkurve hat ihr Maximum nahe 41 MeV', () => {
    const m = findMaximum(published);
    expect(m.eStar_MeV).toBeGreaterThan(40.5);
    expect(m.eStar_MeV).toBeLessThan(41.1);
    expect(m.sigma_fb).toBeGreaterThan(48.2);
    expect(m.sigma_fb).toBeLessThan(52);
    expect(totalCrossSection_fb(published, m.eStar_MeV)).toBe(m.sigma_fb);
  });
});

describe('Messung', () => {
  it('ist reproduzierbar: gleicher Seed, gleiches Ergebnis', () => {
    const a = runExperiment(settings(41, 42, 3000), published);
    const b = runExperiment(settings(41, 42, 3000), published);
    expect(a).toEqual(b);
    expect(a.events.length).toBeGreaterThan(0);
  });

  it('anderer Seed, anderes Ergebnis', () => {
    const a = runExperiment(settings(41, 1, 3000), published);
    const b = runExperiment(settings(41, 2, 3000), published);
    expect(a.events).not.toEqual(b.events);
  });

  it('trägt Version, Seed und Einstellungen', () => {
    const r = runExperiment(settings(41, 7), published);
    expect(r.coreVersion).toBe(CORE_VERSION);
    expect(r.modelVersion).toBe(STAGE1_MODEL_VERSION);
    expect(r.settings.seed).toBe(7);
    expect(r.settings.separatorEfficiency).toBe(0.7);
    expect(r.eStar_MeV).toBeCloseTo(41, 9);
    expect(r.hiddenNature).toBe(false);
  });

  it('Protokoll ist nach Zeit sortiert und liegt in der Strahlzeit', () => {
    const r = runExperiment(settings(41, 11, 5000), published);
    for (let i = 0; i < r.events.length; i++) {
      const e = r.events[i]!;
      expect(e.time_s).toBeGreaterThanOrEqual(0);
      expect(e.time_s).toBeLessThan(r.settings.beamTime_s);
      if (i > 0) expect(e.time_s).toBeGreaterThanOrEqual(r.events[i - 1]!.time_s);
    }
    const identified = r.events.filter((e) => e.verdict.identified).length;
    expect(identified).toBe(r.analysis.chains);
  });

  it('0 Ereignisse: Obergrenze aus 1,84 Ereignissen', () => {
    // 1 Stunde Strahlzeit: praktisch sicher kein Ereignis.
    const r = runExperiment({ ...settings(41, 3), beamTime_s: 3600 }, published);
    expect(r.analysis.chains).toBe(0);
    expect(r.analysis.sigma_fb).toBe(0);
    const minEff = Math.min(...r.channels.filter((c) => c.chainEfficiency !== null).map((c) => c.chainEfficiency!));
    expect(r.analysis.upperLimit_fb! * r.analysis.sensitivity_perFb * minEff).toBeCloseTo(1.841, 3);
  });

  it('alle drei Kanäle von Element 120 sind nachweisbar', () => {
    // Sehr lange Messung bei 52 MeV, damit der 5n-Kanal sicher bevölkert ist.
    const r = runExperiment(settings(52, 5, 20_000), published);
    const n5 = r.channels.find((c) => c.neutrons === 5)!;
    expect(n5.residue).toBe('294-120');
    expect(n5.implanted).toBeGreaterThan(0);
    expect(n5.identified).toBeGreaterThan(0);
    expect(n5.chainEfficiency).toBeCloseTo(0.972, 3);
    expect(r.analysis.channelsOpen).toEqual([]);
    expect(r.analysis.channelsIncluded).toEqual([3, 4, 5]);
    expect(r.events.some((e) => e.neutrons === 5 && e.endsAt === '282Fl')).toBe(true);
  });

  it('gemessene Trefferquote trifft die wahre Kurve im Mittel', () => {
    for (const eStar of [34, 41, 46, 52]) {
      const r = runExperiment(settings(eStar, 2026, 400_000), published);
      const truth = totalCrossSection_fb(published, eStar);
      const a = r.analysis;
      expect(a.chains).toBeGreaterThan(200);
      // innerhalb von 4 Standardfehlern
      expect(Math.abs(a.sigma_fb - truth)).toBeLessThan((4 * truth) / Math.sqrt(a.chains));
      // der 68-%-Fehlerbalken entspricht etwa sqrt(N)
      expect(a.errHigh_fb / a.sigma_fb).toBeCloseTo(1 / Math.sqrt(a.chains), 1);
    }
  });

  it('Fehlerbalken überdecken den wahren Wert in etwa 68 % der Messungen', () => {
    const truth = totalCrossSection_fb(published, 41);
    let covered = 0;
    const runs = 4000;
    for (let seed = 1; seed <= runs; seed++) {
      const a = runExperiment(settings(41, seed, 1500), published).analysis;
      const lo = a.upperLimit_fb === null ? a.sigma_fb - a.errLow_fb : 0;
      const hi = a.upperLimit_fb === null ? a.sigma_fb + a.errHigh_fb : a.upperLimit_fb;
      if (truth >= lo && truth <= hi) covered++;
    }
    // Gehrels-Grenzen sind bei kleinen Zahlen leicht vorsichtig: Überdeckung >= 68 %.
    expect(covered / runs).toBeGreaterThan(0.68);
    expect(covered / runs).toBeLessThan(0.85);
  });

  it('begrenzt das gespeicherte Protokoll, zählt aber alles', () => {
    const r = runExperiment(settings(41, 9, 400_000), published, { maxStoredEvents: 50 });
    expect(r.events.length).toBe(50);
    expect(r.eventsTruncated).toBe(true);
    expect(r.analysis.chains).toBeGreaterThan(50);
  });

  it('lehnt unsinnige Einstellungen ab', () => {
    expect(() => runExperiment({ ...settings(41, 1), beamTime_s: 0 }, published)).toThrow();
    expect(() => runExperiment({ ...settings(41, 1), beamPerSecond: -1 }, published)).toThrow();
    expect(() => runExperiment({ ...settings(41, 1), separatorEfficiency: 1.5 }, published)).toThrow();
    expect(() => runExperiment({ ...settings(41, 1), seed: 1.5 }, published)).toThrow();
    expect(() => runExperiment({ ...settings(41, 1), reactionId: 'Ti50+Pu244' }, published)).toThrow();
  });

  it('mehrere Messungen bei gleicher Energie lassen sich zusammenfassen', () => {
    const runs = [1, 2, 3, 4].map((seed) => runExperiment(settings(41, seed, 2000), published));
    const c = combineRuns(runs);
    expect(c.chains).toBe(runs.reduce((s, r) => s + r.analysis.chains, 0));
    expect(c.sensitivity_perFb).toBeCloseTo(4 * runs[0]!.analysis.sensitivity_perFb, 12);
    expect(c.errHigh_fb / c.sigma_fb).toBeLessThan(runs[0]!.analysis.errHigh_fb / runs[0]!.analysis.sigma_fb);
    expect(() => combineRuns([runs[0]!, runExperiment(settings(45, 1), published)])).toThrow();
    expect(() => combineRuns([])).toThrow();
  });

  it('analyse ohne nachweisbaren Kanal gibt keine Obergrenze', () => {
    const a = analyse(
      [{ neutrons: 5, residue: null, implanted: 3, identified: null, chainEfficiency: null, sigma_fb: null }],
      1,
    );
    expect(a.upperLimit_fb).toBeNull();
    expect(a.channelsOpen).toEqual([5]);
  });
});

describe('Modus „verdeckte Natur“', () => {
  it('Maximum zwischen 6 und 80 fb, Verschiebung höchstens ±5 MeV', () => {
    const base = findMaximum(published);
    let minSigma = Infinity;
    let maxSigma = 0;
    let minShift = Infinity;
    let maxShift = -Infinity;
    for (let seed = 0; seed < 3000; seed++) {
      const n = hiddenNature(r120, seed);
      expect(n.hidden).toBe(true);
      const m = findMaximum(n);
      const shift = n.channels[1]!.eStarPeak_MeV - 41;
      minSigma = Math.min(minSigma, m.sigma_fb);
      maxSigma = Math.max(maxSigma, m.sigma_fb);
      minShift = Math.min(minShift, shift);
      maxShift = Math.max(maxShift, shift);
      // alle Kanäle gemeinsam verschoben, Form bleibt
      expect(n.channels[0]!.eStarPeak_MeV - 34).toBeCloseTo(shift, 9);
      expect(n.channels[2]!.eStarPeak_MeV - 52).toBeCloseTo(shift, 9);
      expect(m.eStar_MeV - base.eStar_MeV).toBeCloseTo(shift, 1);
      expect(n.channels[0]!.sigmaMax_fb / n.channels[1]!.sigmaMax_fb).toBeCloseTo(12.87 / 48.2, 9);
    }
    expect(minSigma).toBeGreaterThanOrEqual(HIDDEN_NATURE.sigmaMaxMin_fb - 1e-9);
    expect(maxSigma).toBeLessThanOrEqual(HIDDEN_NATURE.sigmaMaxMax_fb + 1e-9);
    expect(minSigma).toBeLessThan(6.2); // der Bereich wird auch ausgeschöpft
    expect(maxSigma).toBeGreaterThan(78);
    expect(minShift).toBeGreaterThanOrEqual(-5);
    expect(maxShift).toBeLessThanOrEqual(5);
    expect(minShift).toBeLessThan(-4.9);
    expect(maxShift).toBeGreaterThan(4.9);
  });

  it('ist über den Seed reproduzierbar', () => {
    expect(hiddenNature(r120, 123)).toEqual(hiddenNature(r120, 123));
    expect(hiddenNature(r120, 123)).not.toEqual(hiddenNature(r120, 124));
  });

  it('eine Messreihe findet das verdeckte Maximum', () => {
    const nature = hiddenNature(r120, 20261110);
    const truth = findMaximum(nature);
    let best = { eStar: 0, sigma: -1 };
    for (let eStar = 30; eStar <= 52; eStar += 2) {
      const r = runExperiment(settings(eStar, 1000 + eStar, 100_000), nature);
      expect(r.hiddenNature).toBe(true);
      if (r.analysis.sigma_fb > best.sigma) best = { eStar, sigma: r.analysis.sigma_fb };
    }
    expect(Math.abs(best.eStar - truth.eStar_MeV)).toBeLessThanOrEqual(2);
  });
});
