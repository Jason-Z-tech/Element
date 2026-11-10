import { describe, expect, it } from 'vitest';
import { bassBarrier, mulberry32 } from '../src';
import { buildBarrierTable, gaussLegendre01, shapeFactor, transmission, y20, y40, y60 } from '../src/stage2/capture';
import {
  BETA1_LINEAR,
  diffusionProbability,
  erfc,
  fusionGeometry,
  levelDensityParameter,
  meanBarrierB0,
  pairingEnergy,
  smoothLevelDensityParameter,
  vFiss,
} from '../src/stage2/fusion';
import { diffusionByTrajectories } from '../src/stage2/langevin';
import { crossSections, fusionStage, prepareReaction, type ModelParameters } from '../src/stage2/model';
import { getHeavyNucleus, measuredMassExcess, targetDeformation } from '../src/stage2/nuclei';
import { buildChain, cascade, createWorkspace, widths } from '../src/stage2/survival';

const SPHERE = { beta2: 0, beta4: 0, beta6: 0 };
const BASS = { kind: 'bass' } as const;
const HAGINO_WS = { kind: 'woods-saxon', v0_MeV: 70, r0_fm: 1.18, a_fm: 0.69 } as const;
const HAGINO_DEFORMATION = { beta2: 0.297, beta4: 0.039, beta6: -0.035 };
const CA_CM = { id: 'Ca48+Cm248', projectile: { symbol: 'Ca', z: 20, a: 48 }, target: { symbol: 'Cm', z: 96, a: 248 } };
const PARAMS: ModelParameters = { sInjA_fm: 4.698, sInjB_fmPerMeV: 0.16, orientationDependentInjection: true, potential: BASS, nTheta: 24 };

describe('Eingangstabellen (Stichproben gegen die Quellen)', () => {
  it('Jachimowicz, Kowal, Skalski 2021: 299-120, 295-120 und 294Lv', () => {
    expect(getHeavyNucleus(120, 299)).toMatchObject({ massExcess: 216.87, eGround: -6.23, shellGround: -6.29, sn: 6.38, bf: 5.57, shellSaddle: -0.86 });
    expect(getHeavyNucleus(120, 295)).toMatchObject({ sn: 7.4, bf: 6.28 });
    expect(getHeavyNucleus(116, 294)).toMatchObject({ massExcess: 190.41, sn: 6.79, bf: 6.37 });
    // Spaltbarriere = Sattelenergie − Grundzustandsenergie: −0,66 − (−6,23) = 5,57
    expect(getHeavyNucleus(120, 299).eGround + getHeavyNucleus(120, 299).bf).toBeCloseTo(-0.66, 9);
  });
  it('AME2020 und FRDM(2012)', () => {
    expect(measuredMassExcess(22, 50)).toBeCloseTo(-51.431867, 6);
    expect(measuredMassExcess(98, 249)).toBeCloseTo(69.722733, 6);
    expect(targetDeformation(96, 248)).toEqual({ beta2: 0.25, beta4: 0.039, beta6: -0.035 });
  });
  it('Q-Wert 50Ti + 249Cf aus AME2020 und Warschauer Tabelle: −198,58 MeV', () => {
    const prep = prepareReaction({ id: 'x', projectile: { symbol: 'Ti', z: 22, a: 50 }, target: { symbol: 'Cf', z: 98, a: 249 } }, PARAMS);
    expect(prep.qValue).toBeCloseTo(-198.58, 2);
  });
});

describe('Stufe A: Einfang', () => {
  it('Kugelflächenfunktionen an Spitze und Flanke', () => {
    expect(y20(1)).toBeCloseTo(Math.sqrt(5 / (4 * Math.PI)), 12);
    expect(y20(0)).toBeCloseTo(-0.5 * Math.sqrt(5 / (4 * Math.PI)), 12);
    expect(y40(1)).toBeCloseTo(Math.sqrt(9 / (4 * Math.PI)), 12);
    expect(y60(1)).toBeCloseTo(Math.sqrt(13 / (4 * Math.PI)), 12);
    expect(shapeFactor(SPHERE, 0.3)).toBe(0);
  });
  it('Gauß-Legendre: Gewichte summieren sich zu 1, Polynome werden exakt integriert', () => {
    const { x, w } = gaussLegendre01(24);
    let sum = 0;
    let x6 = 0;
    for (let i = 0; i < 24; i++) {
      sum += w[i]!;
      x6 += w[i]! * x[i]! ** 6;
    }
    expect(sum).toBeCloseTo(1, 12);
    expect(x6).toBeCloseTo(1 / 7, 12);
  });
  it('ohne Deformation ergibt sich die Bass-Barriere aus Stufe 1 (226,2 und 217,2 MeV)', () => {
    const cf = buildBarrierTable({ zp: 22, ap: 50, zt: 98, at: 249, deformation: SPHERE, potential: BASS }, 4, 5);
    const pu = buildBarrierTable({ zp: 22, ap: 50, zt: 94, at: 244, deformation: SPHERE, potential: BASS }, 4, 5);
    expect(cf.vb[0]).toBeCloseTo(bassBarrier(22, 50, 98, 249).height_MeV, 3);
    expect(cf.vb[0]).toBeCloseTo(226.2, 1);
    expect(pu.vb[0]).toBeCloseTo(bassBarrier(22, 50, 94, 244).height_MeV, 3);
    // alle Winkel gleich
    expect(cf.vb[3 * 6]).toBeCloseTo(cf.vb[0]!, 9);
  });
  it('Hill-Wheeler: T = ½ an der Barriere, 0 weit darunter, 1 weit darüber', () => {
    const t = buildBarrierTable({ zp: 20, ap: 48, zt: 96, at: 248, deformation: SPHERE, potential: BASS }, 2, 10);
    const vb = t.vb[0]!;
    expect(transmission(t, 0, 0, vb)).toBeCloseTo(0.5, 12);
    expect(transmission(t, 0, 0, vb - 30)).toBeLessThan(1e-20);
    expect(transmission(t, 0, 0, vb + 30)).toBeGreaterThan(1 - 1e-12);
    expect(transmission(t, 0, 0, vb, 2)).toBeLessThan(0.5); // Barriere um 2 MeV angehoben
    expect(t.hbarOmega[0]).toBeGreaterThan(2);
    expect(t.hbarOmega[0]).toBeLessThan(6);
  });
  it('Zentrifugalterm hebt die Barriere: V_b(ℓ) ≈ V_b(0) + ℓ(ℓ+1)ħ²/(2μR_b²)', () => {
    const t = buildBarrierTable({ zp: 20, ap: 48, zt: 96, at: 248, deformation: SPHERE, potential: BASS }, 2, 40);
    const mu = (48 * 248) / 296;
    const expected = t.vb[0]! + (30 * 31 * 20.900796) / (mu * t.rb[0]! ** 2);
    expect(t.vb[30]!).toBeGreaterThan(t.vb[0]!);
    expect(Math.abs(t.vb[30]! - expected)).toBeLessThan(0.3);
  });
  it('Nachbau von Hagino (2018), Abb. 3a: Barriere 190,5 MeV an der Spitze, 208,9 MeV an der Flanke', () => {
    const t = buildBarrierTable({ zp: 20, ap: 48, zt: 96, at: 248, deformation: HAGINO_DEFORMATION, potential: HAGINO_WS }, 48, 2);
    const flank = t.vb[0]!; // cos θ ≈ 0
    const tip = t.vb[47 * 3]!; // cos θ ≈ 1
    expect(Math.abs(tip - 190.46)).toBeLessThan(0.4);
    expect(Math.abs(flank - 208.9)).toBeLessThan(0.3);
  });
  it('Bass mit winkelabhängigem Radius (eigene Anpassung) liegt 2 bis 4 MeV unter Haginos Potential', () => {
    const t = buildBarrierTable({ zp: 20, ap: 48, zt: 96, at: 248, deformation: HAGINO_DEFORMATION, potential: BASS }, 48, 2);
    expect(208.9 - t.vb[0]!).toBeGreaterThan(2);
    expect(208.9 - t.vb[0]!).toBeLessThan(4.5);
    expect(190.46 - t.vb[47 * 3]!).toBeGreaterThan(1.5);
    expect(190.46 - t.vb[47 * 3]!).toBeLessThan(4);
  });
});

describe('Stufe B: Verschmelzen', () => {
  it('mittlere Barriere B₀: 173,0 / 191,2 / 208,3 MeV für 48Ca, 50Ti, 54Cr + 208Pb (gedruckte Werte)', () => {
    expect(meanBarrierB0(20, 48, 82, 208)).toBeCloseTo(173.0, 1);
    expect(meanBarrierB0(22, 50, 82, 208)).toBeCloseTo(191.2, 1);
    expect(meanBarrierB0(24, 54, 82, 208)).toBeCloseTo(208.3, 1);
  });
  it('innere Barriere: stetig und glatt bei s = 0, null an der Kugel', () => {
    const g = fusionGeometry(20, 48, 96, 248);
    expect(vFiss(g, 1e-9)).toBeCloseTo(vFiss(g, -1e-9), 6);
    const slopeOut = (vFiss(g, 1e-4) - vFiss(g, 0)) / 1e-4;
    const slopeIn = (vFiss(g, 0) - vFiss(g, -1e-4)) / 1e-4;
    expect(slopeOut).toBeCloseTo(slopeIn, 2);
    expect(vFiss(g, g.s0 * g.r)).toBeCloseTo(0, 9);
  });
  it('korrigierter Koeffizient 1,37825 trifft Hagino, Abb. 3c (48Ca + 248Cm)', () => {
    expect(BETA1_LINEAR).toBe(1.37825);
    const g = fusionGeometry(20, 48, 96, 248);
    // aus der Abbildung abgelesen: b = −0,01372, c = −0,01009
    expect(g.b).toBeCloseTo(-0.01372, 4);
    expect(g.c).toBeCloseTo(-0.01009, 4);
    // Unterschied der Barrierenhöhe zwischen Spitze (s = 4,947 fm) und Flanke (s = 3,023 fm): 4,42 MeV
    expect(vFiss(g, 3.023) - vFiss(g, 4.947)).toBeCloseTo(4.42, 1);
  });
  it('Satz von 2003 (Acta Phys. Pol. B 34, 2049) liegt nahe beim korrigierten Satz, nicht beim gedruckten', () => {
    const g2003 = fusionGeometry(20, 48, 96, 248, 'fbd2003');
    const g2011 = fusionGeometry(20, 48, 96, 248);
    expect(g2003.a).toBeCloseTo(g2011.a, 4);
    expect(g2003.c).toBeCloseTo(g2011.c, 3);
    expect(Math.abs(g2003.b - g2011.b)).toBeLessThan(0.004); // −0,0114 gegen −0,0137; gedruckter Wert ergäbe −0,0308
    expect(Math.abs(vFiss(g2003, 3) - vFiss(g2011, 3))).toBeLessThan(1);
  });
  it('Paarenergie und Niveaudichte', () => {
    expect(pairingEnergy(116, 296)).toBeCloseTo(21 / Math.sqrt(296), 12);
    expect(pairingEnergy(116, 295)).toBeCloseTo(10.5 / Math.sqrt(295), 12);
    expect(pairingEnergy(115, 288)).toBe(0);
    expect(smoothLevelDensityParameter(296, 0)).toBeCloseTo(0.0696 * 296 + 0.1801 * 296 ** (2 / 3) + 0.1644 * Math.cbrt(296), 9);
    expect(smoothLevelDensityParameter(296, 0.27)).toBeGreaterThan(smoothLevelDensityParameter(296, 0));
    // Schalendämpfung: bei hoher Energie verschwindet die Korrektur, bei kleiner gilt 1 + E_Schale/E_D
    expect(levelDensityParameter(30, -6, 1e6)).toBeCloseTo(30, 3);
    expect(levelDensityParameter(30, -6, 1e-12)).toBeCloseTo(30 * (1 - 6 / 18.5), 9);
  });
  it('Diffusions-Formel: ½ ohne Barriere, kleiner mit Barriere, größer bei Einschuss innerhalb des Sattels', () => {
    expect(diffusionProbability(0, 1)).toBeCloseTo(0.5, 6);
    expect(diffusionProbability(4, 1)).toBeCloseTo(0.5 * erfc(2), 12);
    expect(diffusionProbability(-4, 1)).toBeCloseTo(1 - 0.5 * erfc(2), 12);
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(erfc(1)).toBeCloseTo(0.157299, 6);
    expect(erfc(3)).toBeCloseTo(2.209e-5, 8);
  });
  it('Einfang und Verschmelzen: σ_fus ≤ σ_Einfang, beide wachsen mit der Energie', () => {
    const prep = prepareReaction(CA_CM, PARAMS);
    const low = fusionStage(prep, 200);
    const high = fusionStage(prep, 212);
    expect(low.sigmaFusion_pb).toBeLessThan(low.sigmaCapture_pb);
    expect(high.sigmaCapture_pb).toBeGreaterThan(low.sigmaCapture_pb);
    expect(high.sigmaFusion_pb).toBeGreaterThan(low.sigmaFusion_pb);
    expect(high.eStar - low.eStar).toBeCloseTo(12, 9);
    // Größenordnung des Einfangs oberhalb der Barriere: einige hundert Millibarn (1 mb = 1e9 pb)
    const top = fusionStage(prep, 225).sigmaCapture_pb / 1e9;
    expect(top).toBeGreaterThan(200);
    expect(top).toBeLessThan(900);
    // Summe der Teilbeiträge
    expect(high.partial.reduce((s, v) => s + v, 0)).toBeCloseTo(high.sigmaFusion_pb, 6);
  });
});

describe('Bahnen-Kontrolle (Langevin)', () => {
  it.each([0.5, 2, 4])('direkte Bahnen treffen ½ erfc(√(ΔV/T)) für ΔV/T = %f', (h) => {
    const r = diffusionByTrajectories({ barrierOverTemperature: h, trajectories: 20_000, seed: 11 });
    expect(Math.abs(r.probability - r.exact)).toBeLessThan(4 * r.statError + 1e-4);
  });
  it.each([4, 8, 12])('Splitting ist erwartungstreu für ΔV/T = %f', (h) => {
    const r = diffusionByTrajectories({ barrierOverTemperature: h, trajectories: 20_000, seed: 12, split: 4 });
    expect(r.probability).toBeGreaterThan(0);
    expect(Math.abs(r.probability - r.exact)).toBeLessThan(4 * r.statError);
    expect(r.statError / r.probability).toBeLessThan(0.25);
  });
  it('ist reproduzierbar', () => {
    const o = { barrierOverTemperature: 3, trajectories: 2000, seed: 5, split: 3 };
    expect(diffusionByTrajectories(o)).toEqual(diffusionByTrajectories(o));
  });
});

describe('Stufe C: Überleben', () => {
  const chain = buildChain(116, 296);
  const none = new Float64Array(10);
  it('Kette folgt der Massentabelle', () => {
    expect(chain[0]).toMatchObject({ z: 116, a: 296, sn: 6.66, bf: 6.25 });
    expect(chain[3]!.a).toBe(293);
    expect(chain.length).toBe(9);
  });
  it('unterhalb beider Schwellen: weder Neutron noch Spaltung', () => {
    const w = widths(chain, 0, 5, 0, 0, createWorkspace());
    expect(w.epsMax).toBeLessThan(0);
    expect(w.kMax).toBeLessThan(0);
    const out = new Float64Array(1);
    expect(cascade(chain, 5, 0, none, mulberry32(1), createWorkspace(), out)).toBe(0);
    expect(out[0]).toBe(1);
  });
  it('ohne Spaltung (Barriere unerreichbar hoch) überlebt jeder Kern: Summe über alle Kanäle = 1', () => {
    const high = new Float64Array(10).fill(500);
    const rng = mulberry32(3);
    const work = createWorkspace();
    const out = new Float64Array(1);
    const counts = new Float64Array(9);
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const x = cascade(chain, 40, 10, high, rng, work, out);
      expect(x).toBeGreaterThanOrEqual(0);
      counts[x] = counts[x]! + out[0]!;
    }
    expect(counts.reduce((s, v) => s + v, 0) / n).toBeCloseTo(1, 12);
    // bei 40 MeV werden meist 4 Neutronen abgedampft
    expect(counts[4]! / n).toBeGreaterThan(0.4);
    expect(counts[2]! / n).toBeLessThan(0.01);
  });
  it('höhere Spaltbarriere erhöht Γ_n/(Γ_n + Γ_f); höhere Energie begünstigt mehr Neutronen', () => {
    const work = createWorkspace();
    const base = widths(chain, 0, 35, 0, 0, work).neutronProbability;
    const raised = widths(chain, 0, 35, 0, 1, work).neutronProbability;
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(1);
    expect(raised).toBeGreaterThan(base);
    // 1 MeV Barriere: etwa ein Faktor 2 bis 20 in Γ_n/Γ_f
    const ratio = raised / (1 - raised) / (base / (1 - base));
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(20);
  });
  it('Energie-Integrale: grobes Gitter stimmt mit feiner Rechnung überein', () => {
    // Γ_n/Γ_f mit den 48 Stützstellen gegen eine direkte Summe mit 20000 Schritten
    const work = createWorkspace();
    const e = 35;
    const w = widths(chain, 0, e, 0, 0, work);
    const p = chain[0]!;
    const d = chain[1]!;
    const rho = (aSmooth: number, shell: number, u: number) => Math.exp(2 * Math.sqrt(levelDensityParameter(aSmooth, shell, u) * u));
    let iN = 0;
    let iF = 0;
    const steps = 20000;
    for (let i = 0; i < steps; i++) {
      const eps = ((i + 0.5) / steps) * w.epsMax;
      iN += rho(d.aSmoothGround, d.shellGround, w.epsMax - eps) * eps * (w.epsMax / steps);
      const k = ((i + 0.5) / steps) * w.kMax;
      iF += rho(p.aSmoothSaddle, p.shellSaddle, w.kMax - k) * (w.kMax / steps);
    }
    const ratio = ((4 * 939.56542052 * 1.45 * 1.45) / 197.3269804 ** 2) * 296 ** (2 / 3) * (iN / iF);
    expect(w.neutronProbability).toBeCloseTo(ratio / (1 + ratio), 3);
  });
});

describe('Gesamtrechnung', () => {
  it('ist reproduzierbar und liefert für 48Ca + 248Cm Pikobarn im 3n- und 4n-Kanal', () => {
    const prep = prepareReaction(CA_CM, { ...PARAMS, potential: HAGINO_WS, deformation: HAGINO_DEFORMATION });
    const a = crossSections(prep, 210, { cascades: 4000, seed: 9 });
    const b = crossSections(prep, 210, { cascades: 4000, seed: 9 });
    expect(a).toEqual(b);
    const n3 = a.channels[2]!.sigma_pb;
    const n4 = a.channels[3]!.sigma_pb;
    // Mit Haginos Parametern, ohne Eichung: Größenordnung der Messwerte (1,2 und 3,3 pb)
    expect(n3).toBeGreaterThan(0.05);
    expect(n3).toBeLessThan(20);
    expect(n4).toBeGreaterThan(0.3);
    expect(n4).toBeLessThan(60);
    expect(a.channels[3]!.statError_pb).toBeLessThan(0.1 * n4);
  });
});
