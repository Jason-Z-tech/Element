import { excitationForELab } from '@elementjaeger/core';
import { describe, expect, it } from 'vitest';
import { decadeTicks, makeScales, yDomain, curvePath } from '../src/chartMath';
import { simulate } from '../src/simulate';
import {
  currentQ,
  currentRuns,
  defaultControls,
  effectiveMode,
  hiddenAllowed,
  initialState,
  measuredPoints,
  parseState,
  seedForRun,
  seriesKey,
  totalDays,
  type AppState,
  type StoredRun,
} from '../src/state';

function run(state: AppState, id: number, eLab: number, days: number): StoredRun {
  const hidden = effectiveMode(state) === 'verdeckt';
  return {
    id,
    seriesKey: seriesKey(state),
    width_MeV: state.params.excitationWidth_MeV,
    result: simulate({
      settings: {
        reactionId: state.reactionId,
        eLab_MeV: eLab,
        beamPerSecond: 6e12,
        thickness_mg_cm2: 0.44,
        beamTime_s: days * 86400,
        qValue_MeV: currentQ(state),
        seed: seedForRun({ ...state, nextRunId: id }),
      },
      nature: { reactionId: state.reactionId, hiddenSeed: hidden ? state.hiddenSeed : null, width_MeV: 4 },
    }),
  };
}

describe('Zustand', () => {
  const base = initialState(123, 456);

  it('Startzustand: Element 120 bei E* = 41 MeV mit Berkeley-Werten', () => {
    expect(base.reactionId).toBe('Ti50+Cf249');
    const c = defaultControls('Ti50+Cf249');
    expect(excitationForELab('Ti50+Cf249', c.eLab_MeV)).toBeCloseTo(41, 1);
    expect(c.beamPerSecond).toBe(6e12);
    expect(c.thickness_mg_cm2).toBe(0.44);
    expect(defaultControls('Ti50+Pu244').days).toBe(22.1);
  });

  it('verdeckte Natur nur für die Vorhersage-Reaktion', () => {
    expect(hiddenAllowed('Ti50+Cf249')).toBe(true);
    expect(hiddenAllowed('Ti50+Pu244')).toBe(false);
    expect(effectiveMode({ ...base, reactionId: 'Ti50+Pu244', mode: 'verdeckt' })).toBe('offen');
  });

  it('Messreihen sind nach Reaktion, Modus und verdeckter Natur getrennt', () => {
    const open = base;
    const hidden: AppState = { ...base, mode: 'verdeckt' };
    const other: AppState = { ...hidden, hiddenSeed: 457 };
    expect(new Set([seriesKey(open), seriesKey(hidden), seriesKey(other)]).size).toBe(3);
    const runs = [run(open, 1, 286.6, 100), run(hidden, 2, 286.6, 100)];
    expect(currentRuns({ ...open, runs }).map((r) => r.id)).toEqual([1]);
    expect(currentRuns({ ...hidden, runs }).map((r) => r.id)).toEqual([2]);
    expect(currentRuns({ ...other, runs })).toEqual([]);
  });

  it('der Q-Wert-Parameter gilt nur für die Hauptreaktion', () => {
    const s: AppState = { ...base, params: { ...base.params, qValue_MeV: -195 } };
    expect(currentQ(s)).toBe(-195);
    expect(currentQ({ ...s, reactionId: 'Ti50+Pu244' })).toBe(-179);
    expect(currentQ(base)).toBe(-197.7);
  });

  it('jede Messung bekommt einen eigenen Seed', () => {
    expect(seedForRun({ ...base, nextRunId: 1 })).not.toBe(seedForRun({ ...base, nextRunId: 2 }));
    expect(seedForRun(base)).toBe(seedForRun(base));
  });

  it('Messungen bei gleicher Energie werden zu einem Punkt zusammengefasst', () => {
    const runs = [run(base, 1, 286.6, 300), run(base, 2, 286.6, 300), run(base, 3, 292, 300)];
    const points = measuredPoints(runs);
    expect(points.length).toBe(2);
    expect(points[0]!.runIds).toEqual([1, 2]);
    expect(points[0]!.days).toBeCloseTo(600, 9);
    expect(points[0]!.analysis.chains).toBe(runs[0]!.result.analysis.chains + runs[1]!.result.analysis.chains);
    expect(points[1]!.eStar_MeV).toBeGreaterThan(points[0]!.eStar_MeV);
    expect(totalDays(runs)).toBeCloseTo(900, 9);
  });

  it('gespeicherter Stand übersteht Speichern und Laden', () => {
    const s: AppState = { ...base, runs: [run(base, 1, 286.6, 300)], nextRunId: 2, selectedRunId: 1 };
    expect(parseState(JSON.stringify(s))).toEqual(s);
  });

  it('unbrauchbare Stände werden verworfen', () => {
    expect(parseState(null)).toBeNull();
    expect(parseState('kein json')).toBeNull();
    expect(parseState(JSON.stringify({ schema: 2 }))).toBeNull();
    expect(parseState(JSON.stringify({ ...base, reactionId: 'unbekannt' }))).toBeNull();
  });

  it('Messung im Worker-Format ist reproduzierbar und verrät die verdeckte Natur nicht', () => {
    const hidden: AppState = { ...base, mode: 'verdeckt' };
    const a = run(hidden, 1, 286.6, 300);
    expect(run(hidden, 1, 286.6, 300)).toEqual(a);
    expect(a.result.hiddenNature).toBe(true);
    expect(JSON.stringify(a.result)).not.toContain('sigmaMax');
  });
});

describe('Maßstäbe der Kurve', () => {
  const box = { left: 50, right: 750, top: 10, bottom: 350 };

  it('logarithmische y-Achse: oben 1-2-5-Schritte, unten ganze Dekade, mindestens zwei Dekaden', () => {
    expect(yDomain([51, 93 + 56, 21.5], 1)).toEqual({ yMin: 1, yMax: 200 });
    expect(yDomain([51], 1)).toEqual({ yMin: 1, yMax: 100 });
    expect(yDomain([440 + 580, 440 - 280], 10)).toEqual({ yMin: 10, yMax: 2000 });
    expect(yDomain([], 1)).toEqual({ yMin: 1, yMax: 100 });
    expect(decadeTicks(1, 1000)).toEqual([1, 10, 100, 1000]);
    expect(decadeTicks(10, 2000)).toEqual([10, 100, 1000]);
  });

  it('Abbildung und Umkehrung', () => {
    const s = makeScales(box, 24, 62, 1, 1000);
    expect(s.x(24)).toBe(50);
    expect(s.x(62)).toBe(750);
    expect(s.y(1)).toBe(350);
    expect(s.y(1000)).toBe(10);
    expect(s.y(10)).toBeCloseTo(350 - 340 / 3, 9);
    expect(s.y(0.01)).toBe(350); // abgeschnitten
    expect(s.xInverse(s.x(41))).toBeCloseTo(41, 9);
  });

  it('Kurventeile unter dem unteren Rand werden ausgelassen', () => {
    const s = makeScales(box, 24, 62, 1, 1000);
    const d = curvePath(s, (e) => 48.2 * Math.exp(-0.5 * ((e - 41) / 4) ** 2));
    expect(d.startsWith('M')).toBe(true);
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect(curvePath(s, () => 0.5)).toBe('');
  });
});
