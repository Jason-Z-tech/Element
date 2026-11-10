import { DEFAULTS } from './data/constants';
import { getDecay } from './data/decays';
import { sampleExponential, type Rng } from './rng';

export interface ChainOptions {
  /** Anteil der Alphas, die mit voller Energie gemessen werden (Standard 0,9). */
  readonly alphaFullEnergyFraction?: number;
  /** Zeitfenster ab dem Einschlag des Kerns in Sekunden (Standard 1 s). */
  readonly window_s?: number;
}

export type ChainStep =
  | {
      readonly type: 'alpha';
      readonly nuclide: string;
      /** Zeit seit dem vorigen Glied in s. */
      readonly dt_s: number;
      /** Zeit seit dem Einschlag in s. */
      readonly t_s: number;
      /** Alpha-Energie laut Datentabelle; `null` = offen. */
      readonly energy_MeV: number | null;
      /** `true` = volle Energie gemessen, `false` = „entwischt“. */
      readonly fullEnergy: boolean;
      readonly estimated: boolean;
    }
  | {
      readonly type: 'sf';
      readonly nuclide: string;
      readonly dt_s: number;
      readonly t_s: number;
      readonly estimated: boolean;
    };

export interface SimulatedChain {
  readonly start: string;
  readonly steps: readonly ChainStep[];
  /** Kern, bei dem die Kette abgeschnitten wurde (langlebig oder Zerfallsart offen), sonst `null`. */
  readonly endsAt: string | null;
}

const LN2 = Math.LN2;

/**
 * Würfelt eine Zerfallskette. Pro Glied werden immer genau drei Zufallszahlen
 * verbraucht (Zeit, Zweig, Nachweis), damit der Zufallsstrom eine feste
 * Struktur hat und die innere Schleife leicht nach WebAssembly wandern kann.
 */
export function simulateChain(start: string, rng: Rng, options: ChainOptions = {}): SimulatedChain {
  const pFull = options.alphaFullEnergyFraction ?? DEFAULTS.alphaFullEnergyFraction.value;
  const steps: ChainStep[] = [];
  let id = start;
  let t = 0;
  for (;;) {
    const n = getDecay(id);
    if (n.modes.length === 0) return { start, steps, endsAt: id };
    const dt = sampleExponential(rng, n.halfLife_s / LN2);
    const uBranch = rng.next();
    const uDetect = rng.next();
    t += dt;
    let acc = 0;
    let mode = n.modes[n.modes.length - 1]!;
    for (const m of n.modes) {
      acc += m.probability;
      if (uBranch < acc) {
        mode = m;
        break;
      }
    }
    const estimated = n.kind !== 'gemessen';
    if (mode.type === 'sf') {
      steps.push({ type: 'sf', nuclide: id, dt_s: dt, t_s: t, estimated });
      return { start, steps, endsAt: null };
    }
    steps.push({
      type: 'alpha',
      nuclide: id,
      dt_s: dt,
      t_s: t,
      energy_MeV: mode.energy_MeV,
      fullEnergy: uDetect < pFull,
      estimated,
    });
    id = mode.daughter;
  }
}

export interface ChainVerdict {
  readonly identified: boolean;
  readonly fullAlphas: number;
  readonly escapedAlphas: number;
  readonly fission: boolean;
}

/**
 * Zählt die Kette? Regel: mindestens 2 voll gemessene Alphas oder 1 volles
 * Alpha plus Spaltung, alles innerhalb des Zeitfensters (1 s) nach dem Einschlag.
 * Annahme: Eine Spaltung wird immer nachgewiesen.
 */
export function judgeChain(chain: SimulatedChain, options: ChainOptions = {}): ChainVerdict {
  const window = options.window_s ?? DEFAULTS.chainWindow.value;
  let fullAlphas = 0;
  let escapedAlphas = 0;
  let fission = false;
  for (const s of chain.steps) {
    if (s.t_s > window) break;
    if (s.type === 'sf') fission = true;
    else if (s.fullEnergy) fullAlphas++;
    else escapedAlphas++;
  }
  return {
    identified: fullAlphas >= 2 || (fullAlphas >= 1 && fission),
    fullAlphas,
    escapedAlphas,
    fission,
  };
}

/**
 * P(T1 + ... + Tk ≤ t) für unabhängige exponentielle Zeiten mit den Raten
 * `rates` (Hypoexponentialverteilung, geschlossene Formel für verschiedene Raten).
 */
export function hypoexponentialCdf(rates: readonly number[], t: number): number {
  const r = rates.slice();
  // Gleiche Raten minimal auseinanderziehen, damit die Formel definiert bleibt.
  for (let i = 0; i < r.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.abs(r[i]! - r[j]!) <= 1e-9 * r[i]!) r[i] = r[i]! * (1 + 1e-6 * (i + 1));
    }
  }
  let survival = 0;
  for (let i = 0; i < r.length; i++) {
    let c = 1;
    for (let j = 0; j < r.length; j++) {
      if (j !== i) c *= r[j]! / (r[j]! - r[i]!);
    }
    survival += c * Math.exp(-r[i]! * t);
  }
  return Math.min(1, Math.max(0, 1 - survival));
}

/**
 * Wahrscheinlichkeit, dass eine Kette ab `start` nach der Zählregel erkannt
 * wird – exakt gerechnet (alle Zweige und Nachweis-Muster durchgezählt), ohne
 * Zufall. Dient der Auswertung als Nachweis-Effizienz und den Tests als
 * unabhängige Kontrolle der Simulation.
 */
export function chainEfficiency(start: string, options: ChainOptions = {}): number {
  const pFull = options.alphaFullEnergyFraction ?? DEFAULTS.alphaFullEnergyFraction.value;
  const window = options.window_s ?? DEFAULTS.chainWindow.value;

  const walk = (id: string, prob: number, fullAlphas: number, rates: readonly number[]): number => {
    const n = getDecay(id);
    if (n.modes.length === 0) return 0;
    const nextRates = [...rates, LN2 / n.halfLife_s];
    let total = 0;
    for (const m of n.modes) {
      if (m.type === 'sf') {
        if (fullAlphas >= 1) total += prob * m.probability * hypoexponentialCdf(nextRates, window);
        continue;
      }
      // Alpha mit voller Energie
      const pA = prob * m.probability * pFull;
      if (fullAlphas + 1 >= 2) total += pA * hypoexponentialCdf(nextRates, window);
      else total += walk(m.daughter, pA, fullAlphas + 1, nextRates);
      // Alpha entwischt
      total += walk(m.daughter, prob * m.probability * (1 - pFull), fullAlphas, nextRates);
    }
    return total;
  };

  return walk(start, 1, 0, []);
}
