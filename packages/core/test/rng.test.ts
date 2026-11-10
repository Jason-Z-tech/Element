import { describe, expect, it } from 'vitest';
import { deriveSeed, logGamma, mulberry32, sampleExponential, samplePoisson } from '../src';

describe('Zufallszahlen', () => {
  it('mulberry32 ist mit gleichem Seed reproduzierbar', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('mulberry32 liefert die bekannte Referenzfolge', () => {
    // Referenzwerte der verbreiteten mulberry32-Implementierung, Seed 1.
    const r = mulberry32(1);
    expect(r.next()).toBeCloseTo(0.6270739405881613, 15);
    expect(r.next()).toBeCloseTo(0.002735721180215478, 15);
  });

  it('ist gleichverteilt in [0, 1)', () => {
    const r = mulberry32(7);
    const n = 200_000;
    let sum = 0;
    let sum2 = 0;
    let min = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const u = r.next();
      min = Math.min(min, u);
      max = Math.max(max, u);
      sum += u;
      sum2 += u * u;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    const mean = sum / n;
    expect(mean).toBeCloseTo(0.5, 2);
    expect(sum2 / n - mean * mean).toBeCloseTo(1 / 12, 2);
  });

  it('deriveSeed trennt die Ströme', () => {
    expect(deriveSeed(1, 3)).not.toBe(deriveSeed(1, 4));
    expect(deriveSeed(1, 3)).not.toBe(deriveSeed(2, 3));
    expect(deriveSeed(1, 3, 4)).not.toBe(deriveSeed(1, 4, 3));
    expect(deriveSeed(5, 9)).toBe(deriveSeed(5, 9));
  });

  it('Exponentialverteilung hat den richtigen Mittelwert', () => {
    const r = mulberry32(3);
    const n = 200_000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleExponential(r, 2.5);
    expect(sum / n).toBeCloseTo(2.5, 1);
  });

  it('logGamma stimmt mit Fakultäten überein', () => {
    expect(logGamma(1)).toBeCloseTo(0, 12);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(logGamma(11)).toBeCloseTo(Math.log(3628800), 9);
    expect(logGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 10);
  });

  it.each([0.02, 2.13, 9.5, 10.5, 37, 400, 25_000])(
    'Poisson: Mittelwert und Varianz für Erwartungswert %f',
    (mean) => {
      const r = mulberry32(99);
      const n = 200_000;
      let sum = 0;
      let sum2 = 0;
      for (let i = 0; i < n; i++) {
        const k = samplePoisson(r, mean);
        sum += k;
        sum2 += k * k;
      }
      const m = sum / n;
      const v = sum2 / n - m * m;
      // 5 Standardfehler Toleranz
      expect(Math.abs(m - mean)).toBeLessThan(5 * Math.sqrt(mean / n));
      expect(Math.abs(v - mean) / mean).toBeLessThan(0.03);
    },
  );

  it('Poisson: Sonderfälle', () => {
    expect(samplePoisson(mulberry32(1), 0)).toBe(0);
    expect(() => samplePoisson(mulberry32(1), -1)).toThrow();
    expect(() => samplePoisson(mulberry32(1), Number.NaN)).toThrow();
  });
});
