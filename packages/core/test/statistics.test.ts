import { describe, expect, it } from 'vitest';
import { poissonCdf, poissonInterval } from '../src';

describe('Poisson-Vertrauensgrenzen (Gehrels 1986, 1 σ)', () => {
  // Tabellenwerte: Gehrels 1986, Tabellen 1 und 2, Spalte 0,8413.
  it.each([
    [0, 0, 1.841],
    [1, 0.173, 3.3],
    [2, 0.708, 4.638],
    [3, 1.367, 5.918],
    [5, 2.84, 8.382],
    [10, 6.891, 14.27],
  ])('n = %i: [%f, %f]', (n, lower, upper) => {
    const i = poissonInterval(n);
    expect(i.lower).toBeCloseTo(lower, 2);
    expect(i.upper).toBeCloseTo(upper, 2);
  });

  it('0 Ereignisse: Obergrenze 1,84 Ereignisse', () => {
    expect(poissonInterval(0).upper).toBeCloseTo(1.84, 2);
    expect(poissonInterval(0).lower).toBe(0);
  });

  it('Berkeley: 2 Ereignisse bei 0,44 pb ergeben +0,58 −0,28 pb', () => {
    const i = poissonInterval(2);
    expect((0.44 * (i.upper - 2)) / 2).toBeCloseTo(0.58, 2);
    expect((0.44 * (2 - i.lower)) / 2).toBeCloseTo(0.28, 2);
  });

  it('große n: Näherung schließt stetig an', () => {
    const exact = poissonInterval(2000);
    const approx = poissonInterval(2001);
    expect(approx.upper - exact.upper).toBeGreaterThan(0.9);
    expect(approx.upper - exact.upper).toBeLessThan(1.1);
    expect(approx.lower - exact.lower).toBeGreaterThan(0.9);
    expect(approx.lower - exact.lower).toBeLessThan(1.1);
  });

  it('Poisson-Verteilungsfunktion', () => {
    expect(poissonCdf(0, 2)).toBeCloseTo(Math.exp(-2), 12);
    expect(poissonCdf(2, 2)).toBeCloseTo(5 * Math.exp(-2), 12);
    expect(poissonCdf(-1, 2)).toBe(0);
    expect(poissonCdf(5000, 1000)).toBeCloseTo(1, 12);
  });

  it('lehnt ungültige n ab', () => {
    expect(() => poissonInterval(-1)).toThrow();
    expect(() => poissonInterval(1.5)).toThrow();
  });
});
