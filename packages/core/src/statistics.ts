import { logGamma } from './rng';

/** Einseitige Irrtumswahrscheinlichkeit zu 1 σ: (1 − 0,682689…)/2. */
export const ONE_SIGMA_TAIL = 0.15865525393145707;

/** Poisson-Verteilungsfunktion P(X ≤ n | mean), im Logarithmus summiert. */
export function poissonCdf(n: number, mean: number): number {
  if (n < 0) return 0;
  if (mean <= 0) return 1;
  const logMean = Math.log(mean);
  let maxLog = -Infinity;
  const logs: number[] = [];
  for (let k = 0; k <= n; k++) {
    const l = -mean + k * logMean - logGamma(k + 1);
    logs.push(l);
    if (l > maxLog) maxLog = l;
  }
  let sum = 0;
  for (const l of logs) sum += Math.exp(l - maxLog);
  return Math.min(1, Math.exp(maxLog) * sum);
}

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  // f fällt monoton; gesucht ist die Nullstelle.
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo <= 1e-13 * Math.max(1, hi)) break;
  }
  return 0.5 * (lo + hi);
}

export interface PoissonInterval {
  /** Untere Grenze des Erwartungswerts (0 bei n = 0). */
  readonly lower: number;
  /** Obere Grenze des Erwartungswerts. */
  readonly upper: number;
}

/**
 * Poisson-Vertrauensgrenzen nach Gehrels (1986), wie in Fachartikeln zu
 * superschweren Elementen üblich: zentrales Intervall, jede Seite mit
 * Irrtumswahrscheinlichkeit `tail` (Standard 15,87 % -> zusammen 68,27 %).
 *
 *   untere Grenze: P(X ≥ n | lower) = tail
 *   obere Grenze:  P(X ≤ n | upper) = tail
 *
 * Für n = 0 ergibt das die Obergrenze 1,84 Ereignisse.
 */
export function poissonInterval(n: number, tail: number = ONE_SIGMA_TAIL): PoissonInterval {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`poissonInterval: n = ${n}`);
  if (n > 2000) {
    // Näherung nach Gehrels (Gl. 9 und 14), bei so großen n besser als 0,1 %.
    // Nur für 1 σ gültig; andere Niveaus werden hier nicht gebraucht.
    if (tail !== ONE_SIGMA_TAIL) throw new RangeError('poissonInterval: n > 2000 nur für 1 σ');
    const m = n + 1;
    const upper = m * Math.pow(1 - 1 / (9 * m) + 1 / (3 * Math.sqrt(m)), 3);
    const lower = n * Math.pow(1 - 1 / (9 * n) - 1 / (3 * Math.sqrt(n)), 3);
    return { lower, upper };
  }
  const hiBound = n + 12 * Math.sqrt(n + 1) + 20;
  const upper = bisect((mean) => poissonCdf(n, mean) - tail, 0, hiBound);
  const lower = n === 0 ? 0 : bisect((mean) => poissonCdf(n - 1, mean) - (1 - tail), 0, hiBound);
  return { lower, upper };
}
