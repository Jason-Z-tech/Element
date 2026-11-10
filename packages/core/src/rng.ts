/**
 * Zufallszahlen mit Seed. Gleicher Seed, gleiche Version -> gleiches Ergebnis,
 * in Browser, Web Worker und Node.
 */
export interface Rng {
  /** Gleichverteilte Zahl in [0, 1). */
  next(): number;
}

/** mulberry32 (Tommy Ettinger): kleiner, schneller 32-Bit-Generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Bit-Mischer (Finalizer von MurmurHash3). */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Leitet aus einem Seed und Zählern einen neuen, unabhängigen Seed ab
 * (z. B. je Kanal oder je Rechenpaket), ohne dass sich Ströme überlappen.
 */
export function deriveSeed(seed: number, ...labels: number[]): number {
  let h = fmix32((seed >>> 0) ^ 0x9e3779b9);
  for (const label of labels) {
    h = fmix32(h ^ fmix32((label >>> 0) + 0x9e3779b9));
  }
  return h >>> 0;
}

/** Exponentialverteilte Zeit mit Mittelwert `mean`. */
export function sampleExponential(rng: Rng, mean: number): number {
  // 1 - u liegt in (0, 1], der Logarithmus ist also immer endlich.
  return -mean * Math.log(1 - rng.next());
}

/** ln Γ(x) für x > 0 (Lanczos, g = 7, n = 9). */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ] as const;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const xm = x - 1;
  let a: number = c[0];
  const t = xm + 7.5;
  for (let i = 1; i < 9; i++) a += (c[i] as number) / (xm + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Poisson-verteilte Zahl mit Erwartungswert `mean`.
 * Kleine Werte: Multiplikationsverfahren (Knuth). Große Werte: PTRS,
 * W. Hörmann, Insurance: Mathematics and Economics 12, 39 (1993).
 */
export function samplePoisson(rng: Rng, mean: number): number {
  if (!(mean >= 0) || !Number.isFinite(mean)) {
    throw new RangeError(`samplePoisson: ungültiger Erwartungswert ${mean}`);
  }
  if (mean === 0) return 0;
  if (mean < 10) {
    const limit = Math.exp(-mean);
    let k = 0;
    let p = rng.next();
    while (p > limit) {
      k++;
      p *= rng.next();
    }
    return k;
  }
  const slam = Math.sqrt(mean);
  const loglam = Math.log(mean);
  const b = 0.931 + 2.53 * slam;
  const a = -0.059 + 0.02483 * b;
  const invalpha = 1.1239 + 1.1328 / (b - 3.4);
  const vr = 0.9277 - 3.6224 / (b - 2);
  for (;;) {
    const u = rng.next() - 0.5;
    const v = rng.next();
    const us = 0.5 - Math.abs(u);
    const k = Math.floor(((2 * a) / us + b) * u + mean + 0.43);
    if (us >= 0.07 && v <= vr) return k;
    if (k < 0 || (us < 0.013 && v > us)) continue;
    if (
      Math.log(v) + Math.log(invalpha) - Math.log(a / (us * us) + b) <=
      -mean + k * loglam - logGamma(k + 1)
    ) {
      return k;
    }
  }
}
