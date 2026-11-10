import { AME2020_RAW } from '../data/stage2/masses';
import { NUCLEI_RAW, TARGET_DEFORMATIONS_RAW } from '../data/stage2/nuclei';

/** Eigenschaften eines schweren Kerns aus der Tabelle von Jachimowicz, Kowal, Skalski (2021). */
export interface HeavyNucleus {
  readonly z: number;
  readonly a: number;
  /** Massenexzess in MeV. */
  readonly massExcess: number;
  /** Grundzustandsenergie relativ zur makroskopischen Kugel in MeV (negativ). */
  readonly eGround: number;
  /** Schalenkorrektur im Grundzustand in MeV. */
  readonly shellGround: number;
  /** Neutronen-Bindungsenergie in MeV. */
  readonly sn: number;
  /** Spaltbarriere in MeV. */
  readonly bf: number;
  /** Schalenkorrektur am Sattel in MeV. */
  readonly shellSaddle: number;
  /** Deformation im Grundzustand, alpha = Σ sqrt((2λ+1)/4π) β_λ. */
  readonly alphaGround: number;
  /** Deformation am Sattel. */
  readonly alphaSaddle: number;
}

const HEAVY = new Map<number, HeavyNucleus>();
for (const r of NUCLEI_RAW) {
  const [z, n, massExcess, eGround, shellGround, sn, bf, shellSaddle, alphaGround, alphaSaddle] = r as [
    number, number, number, number, number, number, number, number, number, number,
  ];
  HEAVY.set(z * 1000 + z + n, { z, a: z + n, massExcess, eGround, shellGround, sn, bf, shellSaddle, alphaGround, alphaSaddle });
}

/** Schwerer Kern (Z = 110 bis 120); `undefined`, wenn er nicht in der Tabelle steht. */
export function findHeavyNucleus(z: number, a: number): HeavyNucleus | undefined {
  return HEAVY.get(z * 1000 + a);
}

export function getHeavyNucleus(z: number, a: number): HeavyNucleus {
  const n = findHeavyNucleus(z, a);
  if (!n) throw new Error(`Kern Z=${z}, A=${a} steht nicht in der Massentabelle`);
  return n;
}

const LIGHT = new Map<number, number>();
for (const r of AME2020_RAW) LIGHT.set(r[0]! * 1000 + r[1]!, r[2]!);

/** Gemessener Massenexzess (AME2020) von Projektil oder Target in MeV. */
export function measuredMassExcess(z: number, a: number): number {
  const m = LIGHT.get(z * 1000 + a);
  if (m === undefined) throw new Error(`Keine AME2020-Masse für Z=${z}, A=${a}`);
  return m;
}

export interface Deformation {
  readonly beta2: number;
  readonly beta4: number;
  readonly beta6: number;
}

const DEFORMATIONS = new Map<number, Deformation>();
for (const r of TARGET_DEFORMATIONS_RAW) {
  DEFORMATIONS.set(r[0]! * 1000 + r[1]!, { beta2: r[2]!, beta4: r[3]!, beta6: r[4]! });
}

/** Deformation eines Targetkerns nach FRDM(2012). */
export function targetDeformation(z: number, a: number): Deformation {
  const d = DEFORMATIONS.get(z * 1000 + a);
  if (!d) throw new Error(`Keine Deformation für Z=${z}, A=${a}`);
  return d;
}
