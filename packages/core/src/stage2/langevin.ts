import { mulberry32 } from '../rng';
import { erfc } from './fusion';

/**
 * Kontrolle der Verschmelzungs-Formel durch Langevin-Bahnen.
 *
 * Überdämpfte Bewegung über eine umgekehrte Parabel, dimensionslos geschrieben:
 *   dy = y dτ + √2 dW,   Start y₀ = −√(2 ΔV / T).
 * Die Wahrscheinlichkeit, auf der Innenseite (y → +∞) zu landen, ist exakt
 *   P = ½ erfc(√(ΔV/T)).
 * Die Bahnen müssen diese Formel treffen; für die Vorhersage werden sie nicht gebraucht.
 *
 * Seltene Bahnen: Splitting an festen Ebenen (jede Bahn, die eine Ebene zum
 * ersten Mal überschreitet, wird in `split` Kopien mit je 1/`split` des Gewichts
 * geteilt). Das Verfahren ist erwartungstreu. Früher Abbruch: Bahnen, die weit
 * nach außen gelaufen sind (4 Einheiten hinter dem Start), kehren nur mit
 * vernachlässigbarer Wahrscheinlichkeit zurück und werden beendet.
 */
export interface LangevinOptions {
  /** ΔV / T. */
  readonly barrierOverTemperature: number;
  /** Zahl der Startbahnen. */
  readonly trajectories: number;
  readonly seed: number;
  /** Zeitschritt in Einheiten der Relaxationszeit (Standard 0,01). */
  readonly dt?: number;
  /** Teilungsfaktor an jeder Ebene; 1 = kein Splitting. */
  readonly split?: number;
  /** Abstand der Ebenen (Standard 0,6). */
  readonly levelSpacing?: number;
}

export interface LangevinResult {
  readonly probability: number;
  /** Statistischer Fehler (68 %). */
  readonly statError: number;
  /** Exakter Wert ½ erfc(√(ΔV/T)). */
  readonly exact: number;
  readonly steps: number;
}

export function diffusionByTrajectories(options: LangevinOptions): LangevinResult {
  const { barrierOverTemperature: h, trajectories, seed } = options;
  const dt = options.dt ?? 0.01;
  const split = options.split ?? 1;
  const spacing = options.levelSpacing ?? 0.6;
  const rng = mulberry32(seed);
  const y0 = -Math.sqrt(2 * h);
  const yTop = 6; // von hier kehrt eine Bahn praktisch nie zurück (½ erfc(6/√2) ≈ 1e-9)
  const yKill = y0 - 4;
  // Exakte Übergangsverteilung der linearen Gleichung für einen Zeitschritt.
  const grow = Math.exp(dt);
  const noise = Math.sqrt(Math.exp(2 * dt) - 1);
  const levels: number[] = [];
  if (split > 1) for (let y = y0 + spacing; y < 0.5; y += spacing) levels.push(y);

  let spare = Number.NaN;
  const normal = (): number => {
    if (!Number.isNaN(spare)) {
      const g = spare;
      spare = Number.NaN;
      return g;
    }
    let u = 0;
    let v = 0;
    let q = 0;
    do {
      u = 2 * rng.next() - 1;
      v = 2 * rng.next() - 1;
      q = u * u + v * v;
    } while (q >= 1 || q === 0);
    const f = Math.sqrt((-2 * Math.log(q)) / q);
    spare = v * f;
    return u * f;
  };

  // Stapel der noch zu rechnenden Bahnstücke: Ort, Gewicht, nächste Ebene.
  const stackY: number[] = [];
  const stackW: number[] = [];
  const stackL: number[] = [];
  let sum = 0;
  let sum2 = 0;
  let steps = 0;
  for (let i = 0; i < trajectories; i++) {
    stackY.push(y0);
    stackW.push(1);
    stackL.push(0);
    let fused = 0;
    while (stackY.length > 0) {
      let y = stackY.pop()!;
      let w = stackW.pop()!;
      let level = stackL.pop()!;
      for (;;) {
        y = y * grow + noise * normal();
        steps++;
        if (y >= yTop) {
          fused += w;
          break;
        }
        if (y <= yKill) break;
        if (level < levels.length && y >= levels[level]!) {
          while (level < levels.length && y >= levels[level]!) level++;
          w /= split;
          for (let k = 1; k < split; k++) {
            stackY.push(y);
            stackW.push(w);
            stackL.push(level);
          }
        }
      }
    }
    sum += fused;
    sum2 += fused * fused;
  }
  const p = sum / trajectories;
  const variance = trajectories > 1 ? Math.max(0, sum2 / trajectories - p * p) / (trajectories - 1) : 0;
  return { probability: p, statError: Math.sqrt(variance), exact: 0.5 * erfc(Math.sqrt(h)), steps };
}
