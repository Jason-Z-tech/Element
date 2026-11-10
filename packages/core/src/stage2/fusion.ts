import { ROT_CONST } from './constants';

/**
 * Stufe B: Verschmelzen. Formeln des Fusion-by-Diffusion-Modells, wie sie
 * K. Hagino, Phys. Rev. C 98, 014607 (2018), Anhang A, zusammenstellt und
 * T. Cap, K. Siwek-Wilczyńska, J. Wilczyński, Phys. Rev. C 83, 054602 (2011),
 * zuschreibt („über Hagino belegt“).
 */

/** Radiuskonstante der Tröpfchen-Geometrie in fm (Hagino 2018, Gl. A2, A7). */
export const R0_FBD = 1.155;

/** Mittlere Barriere B₀ in MeV (Hagino 2018, Gl. 37; Bezugsenergie für den Einschuss-Abstand). */
export function meanBarrierB0(zp: number, ap: number, zt: number, at: number): number {
  const z = (zp * zt) / (Math.cbrt(ap) + Math.cbrt(at));
  return 0.853315 * z + 0.0011695 * z * z - 0.000001544 * z * z * z;
}

/** Linearer Koeffizient von β₁ (korrigiert, siehe Kommentar in `fusionGeometry`). */
export const BETA1_LINEAR = 1.37825;
/** Derselbe Koeffizient, wie er bei Hagino (arXiv:1803.02036v1, Gl. A10) gedruckt ist. */
export const BETA1_LINEAR_AS_PRINTED = 1.137825;

export interface FusionGeometry {
  readonly aCn: number;
  /** Radien von Projektil, Target und Compoundkern in fm. */
  readonly rP: number;
  readonly rT: number;
  readonly r: number;
  /** S₀ = (2R − 2(R_P + R_T))/R: Lage der Kugel auf der s-Achse (in Einheiten von R). */
  readonly s0: number;
  readonly eSurf: number;
  /** Koeffizienten von V_fiss(s) = E_surf [a + b (s/R) + c (s/R)²] für s > 0. */
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/**
 * Koeffizientensatz der inneren Barriere.
 * - `fbd2011`: Fassung von Cap, Siwek-Wilczyńska, Wilczyński (PRC 83, 054602), wie von Hagino 2018
 *   abgedruckt, mit korrigiertem Druckfehler in β₁ (Standard).
 * - `fbd2003`: ursprüngliche Fassung, W. J. Świątecki, K. Siwek-Wilczyńska, J. Wilczyński,
 *   Acta Phys. Pol. B 34, 2049 (2003), Anhang B, Gl. B.5–B.14 (am Original geprüft). Dort geprüft für
 *   0,85 < x < 1,05, |Δ| < 0,25 und −0,1 < s/R < 0,44.
 */
export type BarrierCoefficientSet = 'fbd2011' | 'fbd2003';

export function fusionGeometry(
  zp: number,
  ap: number,
  zt: number,
  at: number,
  set: BarrierCoefficientSet = 'fbd2011',
): FusionGeometry {
  const aCn = ap + at;
  const zCn = zp + zt;
  const rP = R0_FBD * Math.cbrt(ap);
  const rT = R0_FBD * Math.cbrt(at);
  const r = R0_FBD * Math.cbrt(aCn);
  const iso = (aCn - 2 * zCn) / aCn;
  const eSurf = 17.9439 * (1 - 1.7826 * iso * iso) * Math.pow(aCn, 2 / 3);
  const x = (zCn * zCn) / aCn / (50.883 * (1 - 1.7826 * iso * iso));
  const d = Math.pow((rP - rT) / (rP + rT), 2);
  const y = 1 - x;
  const alpha1 = -0.00564 - 0.01936 * Math.exp(-d / 0.0224);
  const alpha2 = 0.05122 + 0.11931 * Math.exp(-d / 0.038);
  const alpha3 = -0.07424 + 0.95959 * d;
  // Hagino druckt in Gl. A10 „1.137825“. Das ist ein Druckfehler: Seine eigene Abb. 3(c) folgt
  // exakt einer Parabel mit b = −0,01372 (aus der EPS-Datei der Abbildung abgelesen); 1,37825
  // ergibt b = −0,01369, der gedruckte Wert −0,03084. Siehe docs/modell-stufe2.md.
  const beta1 = -0.0608 + BETA1_LINEAR * d - 10.7077 * d * d;
  const beta2 = 0.27691 - 2.93119 * d + 12.60944 * d * d;
  const beta3 = -0.02398 - 1.14854 * d;
  const gamma1 = -0.02722 + 0.2231 * d;
  const gamma2 = 0.0205 + 0.32122 * d;
  const gamma3 = 0.03843 + 1.03731 * d;
  const s0 = (2 * r - 2 * (rP + rT)) / r;
  if (set === 'fbd2003') {
    return {
      aCn,
      rP,
      rT,
      r,
      s0,
      eSurf,
      a: -0.00557 - 0.01929 * Math.exp(-d / 0.02283) + (0.048 + 0.12151 * Math.exp(-d / 0.04053)) * y + (-0.073 + 0.94 * d) * y * y,
      b: -0.00858 - 0.05303 * Math.exp(-d / 0.03205) + (0.019 + 0.25663 * Math.exp(-d / 0.07331)) * y,
      c: -0.0256 + 0.1944 * d + (0.0214 + 0.6158 * d) * y,
    };
  }
  return {
    aCn,
    rP,
    rT,
    r,
    s0,
    eSurf,
    a: alpha1 + alpha2 * y + alpha3 * y * y,
    b: beta1 + beta2 * y + beta3 * y * y,
    c: gamma1 + gamma2 * y + gamma3 * y * y,
  };
}

/**
 * Makroskopische Energie entlang des Spalttals in MeV, relativ zur Kugel
 * (Hagino 2018, Gl. A1 für s > 0 und A17 für s < 0). `s` ist der Abstand der
 * Oberflächen der beiden Kugeln in fm.
 */
export function vFiss(g: FusionGeometry, s: number): number {
  const t = s / g.r;
  if (s >= 0) return g.eSurf * (g.a + g.b * t + g.c * t * t);
  const u = t - g.s0;
  const s0 = g.s0;
  return g.eSurf * ((g.b / s0 + (3 * g.a) / (s0 * s0)) * u * u + (g.b / (s0 * s0) + (2 * g.a) / (s0 * s0 * s0)) * u * u * u);
}

/** Paarenergie in MeV: 21/√A (gerade-gerade), 10,5/√A (ungerades A), 0 (ungerade-ungerade). */
export function pairingEnergy(z: number, a: number): number {
  const n = a - z;
  if (z % 2 === 0 && n % 2 === 0) return 21 / Math.sqrt(a);
  if (z % 2 === 1 && n % 2 === 1) return 0;
  return 10.5 / Math.sqrt(a);
}

/** Glatter Niveaudichte-Parameter ã in 1/MeV für Deformation α (Hagino 2018, Gl. A25–A27). */
export function smoothLevelDensityParameter(a: number, alpha: number): number {
  const bs = 1 + Math.pow(0.6416 * alpha - 0.1421 * alpha * alpha, 2);
  const bk = 1 + Math.pow(0.6542 * alpha - 0.0483 * alpha * alpha, 2);
  return 0.0696 * a + 0.1801 * Math.pow(a, 2 / 3) * bs + 0.1644 * Math.cbrt(a) * bk;
}

/** Dämpfungsenergie der Schalenkorrektur in MeV (Hagino 2018, nach Gl. A28). */
export const SHELL_DAMPING_ENERGY = 18.5;

/** Niveaudichte-Parameter mit Schalendämpfung nach Ignatyuk (Hagino 2018, Gl. A28). */
export function levelDensityParameter(aSmooth: number, shell: number, u: number): number {
  if (u <= 1e-9) return aSmooth * (1 + shell / SHELL_DAMPING_ENERGY);
  return aSmooth * (1 + (shell / u) * (1 - Math.exp(-u / SHELL_DAMPING_ENERGY)));
}

/** Trägheitsmoment zweier sich fast berührender Kugeln am Einschuss-Punkt in u fm² (Hagino 2018, Gl. A20). */
export function momentOfInertiaInjection(g: FusionGeometry, ap: number, at: number, sInj: number): number {
  const mu = (ap * at) / (ap + at);
  const dist = g.rP + g.rT + sInj;
  return mu * dist * dist + 0.4 * ap * g.rP * g.rP + 0.4 * at * g.rT * g.rT;
}

/** Trägheitsmoment eines deformierten Kerns in u fm² (Hagino 2018, Gl. A21), b_f = 1 fm. */
export function momentOfInertiaDeformed(a: number, alpha: number): number {
  const r = R0_FBD * Math.cbrt(a);
  return 0.2 * a * r * r * (Math.pow(1 + alpha, 2) + 1 / (1 + alpha)) + 2 * a;
}

/** Rotationsenergie in MeV für Drehimpuls ℓ und Trägheitsmoment J (u fm²). */
export function rotationalEnergy(l: number, inertia: number): number {
  return (l * (l + 1) * ROT_CONST) / inertia;
}

/** Komplementäre Fehlerfunktion (Numerical Recipes, relative Genauigkeit 1,2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * Wahrscheinlichkeit, durch Diffusion über die innere Barriere zu kommen
 * (Smoluchowski, parabelförmige Barriere): P = ½ [1 − erf √(ΔV/T)] für ΔV ≥ 0,
 * P = ½ [1 + erf √(−ΔV/T)] für einen Einschuss-Punkt innerhalb des Sattels
 * (Cap, Kowal, Siwek-Wilczyńska 2022, Gl. 4).
 */
export function diffusionProbability(deltaV: number, temperature: number): number {
  if (!(temperature > 0)) return deltaV < 0 ? 1 : 0;
  return 0.5 * erfc(Math.sign(deltaV) * Math.sqrt(Math.abs(deltaV) / temperature));
}
