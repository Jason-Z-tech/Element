import { describe, expect, it } from 'vitest';
import {
  chainEfficiency,
  decayTable,
  DECAYS,
  getDecay,
  hypoexponentialCdf,
  judgeChain,
  mulberry32,
  REACTIONS,
  simulateChain,
  type SimulatedChain,
} from '../src';

describe('Zerfallsdaten', () => {
  it('Zweige summieren sich zu 1, Töchter existieren', () => {
    for (const n of DECAYS.values()) {
      if (n.modes.length === 0) continue;
      const sum = n.modes.reduce((s, m) => s + m.probability, 0);
      expect(sum).toBeCloseTo(1, 12);
      for (const m of n.modes) if (m.type === 'alpha') expect(DECAYS.has(m.daughter)).toBe(true);
    }
  });

  it('Alpha-Zerfall senkt Z um 2 und A um 4', () => {
    for (const n of DECAYS.values()) {
      for (const m of n.modes) {
        if (m.type !== 'alpha') continue;
        const d = getDecay(m.daughter);
        expect(d.z).toBe(n.z - 2);
        expect(d.a).toBe(n.a - 4);
      }
    }
  });

  it('gemessen und geschätzt sind wie vorgegeben markiert', () => {
    for (const id of ['290Lv', '286Fl', '282Cn', '288Lv', '284Fl', '280Cn', '275Ds', '271Hs']) {
      expect(getDecay(id).kind).toBe('gemessen');
    }
    for (const id of ['294-120', '290Og', '286Lv']) {
      expect(getDecay(id).kind).toBe('vorhersage');
    }
    // 282Fl: Spaltung ist eine Annahme; die Alpha-Variante ist eine Vorhersage.
    expect(getDecay('282Fl').kind).toBe('annahme');
    expect(getDecay('282Fl', decayTable('alpha')).kind).toBe('vorhersage');
    for (const id of ['295-120', '291Og', '287Lv', '283Fl', '279Cn', '296-120', '292Og']) {
      expect(getDecay(id).kind).toBe('schaetzung');
    }
  });

  it('Zahlenwerte wie in den Quellen', () => {
    expect(getDecay('290Lv').halfLife_s).toBeCloseTo(8.2e-3, 12);
    expect(getDecay('286Fl').halfLife_s).toBeCloseTo(0.106, 12);
    expect(getDecay('282Cn').halfLife_s).toBeCloseTo(0.88e-3, 12);
    expect(getDecay('288Lv').halfLife_s).toBeCloseTo(2.0e-3, 12);
    expect(getDecay('284Fl').halfLife_s).toBeCloseTo(2.5e-3, 12);
    expect(getDecay('275Ds').halfLife_s).toBeCloseTo(0.43e-3, 12);
    expect(getDecay('295-120').halfLife_s).toBeCloseTo(12e-6, 15);
    expect(getDecay('271Hs').halfLife_s).toBe(46);
    // Gates et al., Tabelle II: 286Fl mit 31/56 + 1/56 Alpha und 24/56 Spaltung
    expect(getDecay('286Fl').modes.map((m) => m.probability)).toEqual([31 / 56, 1 / 56, 24 / 56]);
    // Ackermann (2025): 284Fl Alpha / Spaltung = 24 / 76
    expect(getDecay('284Fl').modes.map((m) => m.probability)).toEqual([0.24, 0.76]);
    // Saxena et al. (2021): log10 T½ = −5,46 für 294-120
    expect(getDecay('294-120').halfLife_s).toBeCloseTo(3.47e-6, 8);
  });

  it('Alpha-Energien folgen aus Q_alpha: E = Q (A − 4) / A', () => {
    const alpha = (id: string): number => {
      const m = getDecay(id).modes[0]!;
      if (m.type !== 'alpha' || m.energy_MeV === null) throw new Error(id);
      return m.energy_MeV;
    };
    expect(alpha('288Lv')).toBeCloseTo((11.24 * 284) / 288, 2);
    expect(alpha('284Fl')).toBeCloseTo((10.721 * 280) / 284, 2);
    expect(alpha('275Ds')).toBeCloseTo((11.37 * 271) / 275, 2);
    expect(alpha('294-120')).toBeCloseTo((13.24 * 290) / 294, 2);
    expect(alpha('290Og')).toBeCloseTo((12.6 * 286) / 290, 2);
    expect(alpha('286Lv')).toBeCloseTo((11.31 * 282) / 286, 2);
  });

  it('jeder Kanal startet bei einem Kern mit Zerfallsdaten', () => {
    for (const r of Object.values(REACTIONS)) {
      for (const c of r.channels) {
        if (c.residue !== null) {
          const d = getDecay(c.residue);
          expect(d.a).toBe(r.compound.a - c.neutrons);
          expect(d.z).toBe(r.compound.z);
        }
      }
    }
    expect(REACTIONS['Ti50+Cf249'].channels.map((c) => c.residue)).toEqual(['296-120', '295-120', '294-120']);
  });
});

describe('Zerfallskette', () => {
  it('290Lv: Halbwertszeit, Verzweigung 57/43 und 10 % entwischte Alphas', () => {
    const rng = mulberry32(2024);
    const n = 200_000;
    let sumLv = 0;
    let lvBelowHalfLife = 0;
    let flAlpha = 0;
    let escaped = 0;
    let alphas = 0;
    let wrongShape = 0;
    for (let i = 0; i < n; i++) {
      const c = simulateChain('290Lv', rng);
      const lv = c.steps[0]!;
      sumLv += lv.dt_s;
      if (lv.dt_s < 8.2e-3) lvBelowHalfLife++;
      const fl = c.steps[1]!;
      if (lv.nuclide !== '290Lv' || fl.nuclide !== '286Fl') wrongShape++;
      if (fl.type === 'alpha') {
        flAlpha++;
        const cn = c.steps[2];
        if (cn?.type !== 'sf' || cn.nuclide !== '282Cn' || c.steps.length !== 3) wrongShape++;
      } else if (c.steps.length !== 2) {
        wrongShape++;
      }
      for (const s of c.steps) {
        if (s.type === 'alpha') {
          alphas++;
          if (!s.fullEnergy) escaped++;
        }
      }
    }
    expect(wrongShape).toBe(0);
    expect(lvBelowHalfLife / n).toBeCloseTo(0.5, 2); // Median = Halbwertszeit
    expect(sumLv / n).toBeCloseTo(8.2e-3 / Math.LN2, 4); // Mittel = T½ / ln 2
    expect(flAlpha / n).toBeCloseTo(32 / 56, 2);
    expect(escaped / alphas).toBeCloseTo(0.1, 2);
  });

  it('295-120 läuft über sechs Alphas bis 271Hs', () => {
    const c = simulateChain('295-120', mulberry32(5));
    expect(c.steps.map((s) => s.nuclide)).toEqual(['295-120', '291Og', '287Lv', '283Fl', '279Cn', '275Ds']);
    expect(c.endsAt).toBe('271Hs');
    expect(c.steps.every((s) => s.type === 'alpha')).toBe(true);
    expect(c.steps[0]).toMatchObject({ energy_MeV: 12.82, estimated: true });
    expect(c.steps[5]).toMatchObject({ energy_MeV: 11.2, estimated: false });
  });

  it('296-120 endet mit der Spaltung von 284Fl (76 %) oder 280Cn (24 %)', () => {
    const rng = mulberry32(5);
    const n = 100_000;
    let viaCn = 0;
    let wrong = 0;
    for (let i = 0; i < n; i++) {
      const c = simulateChain('296-120', rng);
      const ids = c.steps.map((s) => s.nuclide).join(' ');
      const last = c.steps[c.steps.length - 1]!;
      if (c.endsAt !== null || last.type !== 'sf') wrong++;
      if (ids === '296-120 292Og 288Lv 284Fl 280Cn') viaCn++;
      else if (ids !== '296-120 292Og 288Lv 284Fl') wrong++;
    }
    expect(wrong).toBe(0);
    expect(viaCn / n).toBeCloseTo(0.24, 2);
  });

  it('294-120 (5n): drei Alphas, dann spaltet 282Fl (Annahme)', () => {
    const c = simulateChain('294-120', mulberry32(5));
    expect(c.steps.map((s) => s.nuclide)).toEqual(['294-120', '290Og', '286Lv', '282Fl']);
    expect(c.steps.map((s) => s.type)).toEqual(['alpha', 'alpha', 'alpha', 'sf']);
    expect(c.steps.every((s) => s.estimated)).toBe(true);
    expect(c.endsAt).toBeNull();
  });

  it('294-120 (5n) mit Parameter „Alpha“: weiter über 278Cn und 274Ds bis 270Hs', () => {
    const c = simulateChain('294-120', mulberry32(5), { decays: decayTable('alpha') });
    expect(c.steps.map((s) => s.nuclide)).toEqual(['294-120', '290Og', '286Lv', '282Fl', '278Cn', '274Ds']);
    expect(c.steps.every((s) => s.type === 'alpha')).toBe(true);
    expect(c.endsAt).toBe('270Hs');
  });

  it('beide Zerfallstabellen sind in sich schlüssig', () => {
    for (const table of [decayTable('sf'), decayTable('alpha')]) {
      for (const n of table.values()) {
        if (n.modes.length > 0) expect(n.modes.reduce((s, m) => s + m.probability, 0)).toBeCloseTo(1, 12);
        for (const m of n.modes) {
          if (m.type !== 'alpha') continue;
          const d = getDecay(m.daughter, table);
          expect(d.z).toBe(n.z - 2);
          expect(d.a).toBe(n.a - 4);
        }
      }
    }
    expect(decayTable()).toBe(DECAYS);
  });

  it('ist mit gleichem Seed reproduzierbar', () => {
    expect(simulateChain('295-120', mulberry32(77))).toEqual(simulateChain('295-120', mulberry32(77)));
  });
});

describe('Zählregel', () => {
  const alpha = (t: number, fullEnergy: boolean) =>
    ({ type: 'alpha', nuclide: 'x', dt_s: t, t_s: t, energy_MeV: 10, fullEnergy, estimated: false }) as const;
  const sf = (t: number) => ({ type: 'sf', nuclide: 'x', dt_s: t, t_s: t, estimated: false }) as const;
  const chain = (...steps: SimulatedChain['steps']): SimulatedChain => ({ start: 'x', steps, endsAt: null });

  it('2 volle Alphas zählen', () => {
    expect(judgeChain(chain(alpha(0.01, true), alpha(0.02, true))).identified).toBe(true);
  });
  it('1 volles Alpha plus Spaltung zählt', () => {
    expect(judgeChain(chain(alpha(0.01, true), sf(0.02))).identified).toBe(true);
  });
  it('1 volles Alpha allein zählt nicht', () => {
    expect(judgeChain(chain(alpha(0.01, true), alpha(0.02, false))).identified).toBe(false);
  });
  it('Spaltung ohne volles Alpha zählt nicht', () => {
    expect(judgeChain(chain(alpha(0.01, false), sf(0.02))).identified).toBe(false);
  });
  it('außerhalb von 1 s zählt nicht', () => {
    expect(judgeChain(chain(alpha(0.01, true), sf(1.5))).identified).toBe(false);
    expect(judgeChain(chain(alpha(0.01, true), alpha(1.5, true))).identified).toBe(false);
    expect(judgeChain(chain(alpha(0.01, true), alpha(0.99, true))).identified).toBe(true);
  });
});

describe('Ketten-Effizienz (exakt gerechnet)', () => {
  it('Hypoexponentialverteilung: Grenzfälle', () => {
    expect(hypoexponentialCdf([2], 1)).toBeCloseTo(1 - Math.exp(-2), 12);
    // Summe zweier Zeiten mit Raten 1 und 2: 1 - 2 e^-t + e^-2t
    expect(hypoexponentialCdf([1, 2], 1)).toBeCloseTo(1 - 2 * Math.exp(-1) + Math.exp(-2), 12);
    // gleiche Raten (Erlang-2): 1 - (1 + t) e^-t
    expect(hypoexponentialCdf([1, 1], 1)).toBeCloseTo(1 - 2 * Math.exp(-1), 4);
  });

  it('290Lv ohne Zeitfenster: 0,9 + 0,1 * 32/56 * 0,9 = 0,9514', () => {
    expect(chainEfficiency('290Lv', { window_s: 1e9 })).toBeCloseTo(0.9 + 0.1 * (32 / 56) * 0.9, 12);
  });

  it('290Lv mit 1 s Fenster: 95 %, wie von Gates et al. veröffentlicht', () => {
    const e = chainEfficiency('290Lv');
    expect(e).toBeLessThan(0.9515);
    expect(e).toBeGreaterThan(0.9495);
    expect(e).toBeCloseTo(0.95, 2);
  });

  it('294-120 (5n): 99,9 % mit Spaltung von 282Fl, nur verloren wenn alle drei Alphas entwischen', () => {
    expect(chainEfficiency('294-120')).toBeCloseTo(1 - 0.1 ** 3, 9);
  });

  it('294-120 (5n) mit Parameter „Alpha“: mindestens 2 von 6 Alphas voll gemessen', () => {
    expect(chainEfficiency('294-120', { decays: decayTable('alpha') })).toBeCloseTo(1 - 0.1 ** 6 - 6 * 0.9 * 0.1 ** 5, 9);
  });

  it.each(['290Lv', '295-120', '296-120', '294-120'])('%s: Simulation stimmt mit exakter Rechnung überein', (start) => {
    const rng = mulberry32(31337);
    const n = 400_000;
    let identified = 0;
    for (let i = 0; i < n; i++) if (judgeChain(simulateChain(start, rng)).identified) identified++;
    const exact = chainEfficiency(start);
    const stderr = Math.sqrt((exact * (1 - exact)) / n) + 1e-6;
    expect(Math.abs(identified / n - exact)).toBeLessThan(5 * stderr);
  });

  it('kurzes Fenster: Simulation und exakte Rechnung stimmen auch dort überein', () => {
    const rng = mulberry32(4711);
    const n = 400_000;
    const opt = { window_s: 0.05 };
    let identified = 0;
    for (let i = 0; i < n; i++) if (judgeChain(simulateChain('290Lv', rng), opt).identified) identified++;
    const exact = chainEfficiency('290Lv', opt);
    expect(exact).toBeLessThan(0.8);
    expect(Math.abs(identified / n - exact)).toBeLessThan(5 * Math.sqrt((exact * (1 - exact)) / n));
  });
});
