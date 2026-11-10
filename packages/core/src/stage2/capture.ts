import { E2_MEV_FM } from '../data/constants';
import { ROT_CONST, AMU, HBARC } from './constants';
import type { Deformation } from './nuclei';

/**
 * Stufe A: Einfang. Potential zwischen Projektil und deformiertem Target für
 * festen Winkel θ, Barriere daraus numerisch, Durchdringung nach Hill-Wheeler
 * (K. Hagino, Phys. Rev. C 98, 014607 (2018), Gl. 26–30).
 */

/** Kernpotential: Bass 1977 mit winkelabhängigem Targetradius (eigene Anpassung) oder Woods-Saxon wie bei Hagino. */
export type NuclearPotential =
  | { readonly kind: 'bass' }
  | { readonly kind: 'woods-saxon'; readonly v0_MeV: number; readonly r0_fm: number; readonly a_fm: number };

export interface CaptureSystem {
  readonly zp: number;
  readonly ap: number;
  readonly zt: number;
  readonly at: number;
  readonly deformation: Deformation;
  readonly potential: NuclearPotential;
}

/** Y_λ0(θ) für λ = 2, 4, 6 als Funktion von x = cos θ. */
export function y20(x: number): number {
  return Math.sqrt(5 / (4 * Math.PI)) * 0.5 * (3 * x * x - 1);
}
export function y40(x: number): number {
  const x2 = x * x;
  return Math.sqrt(9 / (4 * Math.PI)) * 0.125 * (35 * x2 * x2 - 30 * x2 + 3);
}
export function y60(x: number): number {
  const x2 = x * x;
  return Math.sqrt(13 / (4 * Math.PI)) * 0.0625 * (231 * x2 * x2 * x2 - 315 * x2 * x2 + 105 * x2 - 5);
}

/** Σ_λ β_λ Y_λ0(θ): relative Änderung des Targetradius in Richtung θ. */
export function shapeFactor(d: Deformation, cosTheta: number): number {
  return d.beta2 * y20(cosTheta) + d.beta4 * y40(cosTheta) + d.beta6 * y60(cosTheta);
}

function bassRadius(a: number): number {
  const a13 = Math.cbrt(a);
  return 1.16 * a13 - 1.39 / a13;
}

/** Potential ohne Zentrifugalterm in MeV. */
export function potentialWithoutRotation(sys: CaptureSystem, r: number, cosTheta: number): number {
  const d = sys.deformation;
  const shape = shapeFactor(d, cosTheta);
  // Coulomb-Potential des deformierten Kerns (Hagino 2018, Gl. 27), R_T = 1,2 A^(1/3) fm.
  const rT = 1.2 * Math.cbrt(sys.at);
  const zze2 = sys.zp * sys.zt * E2_MEV_FM.value;
  const q = rT / r;
  const q2 = q * q;
  const vC =
    (zze2 / r) *
    (1 +
      (3 / 5) * q2 * (d.beta2 + (2 / 7) * Math.sqrt(5 / Math.PI) * d.beta2 * d.beta2) * y20(cosTheta) +
      (3 / 9) * q2 * q2 * (d.beta4 + (9 / (7 * Math.sqrt(Math.PI))) * d.beta2 * d.beta2) * y40(cosTheta) +
      (3 / 13) * q2 * q2 * q2 * d.beta6 * y60(cosTheta));
  let vN: number;
  if (sys.potential.kind === 'bass') {
    // Bass 1977 mit R_T(θ) = R_T (1 + Σ β_λ Y_λ0(θ)): eigene Anpassung (Annahme A1).
    const rp = bassRadius(sys.ap);
    const rt = bassRadius(sys.at) * (1 + shape);
    const s = r - rp - rt;
    vN = -((rp * rt) / (rp + rt)) / (0.03 * Math.exp(s / 3.3) + 0.0061 * Math.exp(s / 0.65));
  } else {
    // Woods-Saxon (Hagino 2018, Gl. 26).
    const p = sys.potential;
    const r0 = p.r0_fm * (Math.cbrt(sys.ap) + Math.cbrt(sys.at));
    vN = -p.v0_MeV / (1 + Math.exp((r - r0 - rT * shape) / p.a_fm));
  }
  return vC + vN;
}

/** Stützstellen und Gewichte der Gauß-Legendre-Quadratur auf [0, 1]. */
export function gaussLegendre01(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 1;
    for (let iter = 0; iter < 100; iter++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = 0.5 * (1 - z);
    w[i] = 1 / ((1 - z * z) * dp * dp);
  }
  return { x, w };
}

export interface BarrierTable {
  readonly nTheta: number;
  readonly lMax: number;
  /** cos θ der Stützstellen und ihre Gewichte (Summe 1). */
  readonly cosTheta: Float64Array;
  readonly weight: Float64Array;
  /** Barrierenhöhe V_b(θ, ℓ) in MeV, Index iTheta * (lMax + 1) + ℓ; NaN = keine Barriere (keine Potentialtasche). */
  readonly vb: Float64Array;
  /** Krümmung ħΩ(θ, ℓ) in MeV. */
  readonly hbarOmega: Float64Array;
  /** Barrierenradius R_b(θ, ℓ) in fm. */
  readonly rb: Float64Array;
}

/** Barrieren für alle Winkel-Stützstellen und Drehimpulse. Hängt nicht von der Energie ab. */
export function buildBarrierTable(sys: CaptureSystem, nTheta = 24, lMax = 120): BarrierTable {
  const { x, w } = gaussLegendre01(nTheta);
  const size = nTheta * (lMax + 1);
  const vb = new Float64Array(size).fill(Number.NaN);
  const hbarOmega = new Float64Array(size).fill(Number.NaN);
  const rb = new Float64Array(size).fill(Number.NaN);
  const mu = (sys.ap * sys.at) / (sys.ap + sys.at); // in u
  const rotPerL = ROT_CONST / mu; // ħ²/(2μ) in MeV fm²
  const dr = 0.05;
  const rOuter = 24;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < nTheta; it++) {
    const c = x[it]!;
    const rInner = Math.max(6, bassRadius(sys.ap) + bassRadius(sys.at) * (1 + shapeFactor(sys.deformation, c)) - 2.5);
    const n = Math.floor((rOuter - rInner) / dr);
    const base = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) base[i] = potentialWithoutRotation(sys, rInner + i * dr, c);
    for (let l = 0; l <= lMax; l++) {
      const cl = l * (l + 1) * rotPerL;
      const v = (r: number): number => potentialWithoutRotation(sys, r, c) + cl / (r * r);
      // Von außen nach innen: erstes lokales Maximum ist die Barriere.
      let found = -1;
      let prev = base[n]! + cl / (rOuter * rOuter);
      for (let i = n - 1; i >= 1; i--) {
        const r = rInner + i * dr;
        const cur = base[i]! + cl / (r * r);
        if (cur < prev) {
          found = i + 1;
          break;
        }
        prev = cur;
      }
      if (found < 0) break; // keine Tasche mehr: auch für größere ℓ nicht
      let lo = rInner + (found - 1) * dr;
      let hi = rInner + Math.min(n, found + 1) * dr;
      let x1 = hi - phi * (hi - lo);
      let x2 = lo + phi * (hi - lo);
      let f1 = v(x1);
      let f2 = v(x2);
      for (let k = 0; k < 40; k++) {
        if (f1 < f2) {
          lo = x1;
          x1 = x2;
          f1 = f2;
          x2 = lo + phi * (hi - lo);
          f2 = v(x2);
        } else {
          hi = x2;
          x2 = x1;
          f2 = f1;
          x1 = hi - phi * (hi - lo);
          f1 = v(x1);
        }
      }
      const r = 0.5 * (lo + hi);
      const h = 0.05;
      const second = (v(r + h) - 2 * v(r) + v(r - h)) / (h * h);
      if (!(second < 0)) break;
      const idx = it * (lMax + 1) + l;
      vb[idx] = v(r);
      rb[idx] = r;
      hbarOmega[idx] = HBARC * Math.sqrt(-second / (mu * AMU));
    }
  }
  return { nTheta, lMax, cosTheta: x, weight: w, vb, hbarOmega, rb };
}

/** Durchdringung nach Hill-Wheeler (Hagino 2018, Gl. 30). `barrierShift` verschiebt alle Barrieren (Unsicherheit). */
export function transmission(table: BarrierTable, iTheta: number, l: number, eCm: number, barrierShift = 0): number {
  if (l > table.lMax) return 0;
  const idx = iTheta * (table.lMax + 1) + l;
  const vb = table.vb[idx]!;
  if (Number.isNaN(vb)) return 0;
  const x = ((2 * Math.PI) / table.hbarOmega[idx]!) * (vb + barrierShift - eCm);
  return x > 700 ? 0 : 1 / (1 + Math.exp(x));
}
