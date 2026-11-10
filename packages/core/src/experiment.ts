import { DEFAULTS } from './data/constants';
import { getReaction } from './data/reactions';
import { channelCrossSection_fb, type Nature } from './crossSection';
import { chainEfficiency, judgeChain, simulateChain, type ChainStep, type ChainVerdict } from './decayChain';
import { eCmFromLab, eLabFromCm, excitationEnergy } from './kinematics';
import { sensitivityPerSecondPerFb, targetNucleiPerCm2 } from './rate';
import { deriveSeed, mulberry32, samplePoisson } from './rng';
import { poissonInterval } from './statistics';
import { CORE_VERSION, STAGE1_MODEL_VERSION } from './version';

/** Einstellungen des Steuerpults für eine Messung. */
export interface RunSettings {
  readonly reactionId: string;
  /** Strahlenergie im Labor in MeV. */
  readonly eLab_MeV: number;
  /** Strahlstärke in Kernen pro Sekunde. */
  readonly beamPerSecond: number;
  /** Targetdicke in mg/cm². */
  readonly thickness_mg_cm2: number;
  /** Strahlzeit in Sekunden. */
  readonly beamTime_s: number;
  /** Transmission des Separators (Standard 0,70). */
  readonly separatorEfficiency?: number;
  /** Seed: gleicher Seed, gleiche Einstellungen, gleiche Version -> gleiches Ergebnis. */
  readonly seed: number;
}

/** Ein Kern, der im Detektor angekommen ist, samt Zerfallskette. */
export interface DetectorEvent {
  /** Zeitpunkt des Einschlags seit Beginn der Strahlzeit in s. */
  readonly time_s: number;
  /** Zahl der abgedampften Neutronen (Kanal). */
  readonly neutrons: number;
  readonly residue: string;
  readonly steps: readonly ChainStep[];
  readonly endsAt: string | null;
  readonly verdict: ChainVerdict;
}

export interface ChannelResult {
  readonly neutrons: number;
  readonly residue: string | null;
  /** Kerne hinter dem Separator (in echt nicht direkt sichtbar). */
  readonly implanted: number;
  /** Davon als Kette erkannt. `null`, wenn es für den Kanal keine Zerfallsdaten gibt. */
  readonly identified: number | null;
  /** Nachweis-Effizienz der Kette nach der Zählregel; `null` ohne Zerfallsdaten. */
  readonly chainEfficiency: number | null;
  /** Wirkungsquerschnitt des Kanals in fb; `null` ohne Zerfallsdaten. */
  readonly sigma_fb: number | null;
}

/** Auswertung wie in Fachartikeln. */
export interface RunAnalysis {
  /** Erkannte Ketten insgesamt. */
  readonly chains: number;
  /** Erwartete Kerne hinter dem Separator pro fb (ohne Ketten-Effizienz). */
  readonly sensitivity_perFb: number;
  /** Kanäle, die in die Summe eingehen (mit Zerfallsdaten). */
  readonly channelsIncluded: readonly number[];
  /** Kanäle ohne Zerfallsdaten: erzeugt, aber nicht nachweisbar (offen). */
  readonly channelsOpen: readonly number[];
  /** Gemessener Wirkungsquerschnitt (Summe der nachweisbaren Kanäle) in fb; 0 bei keinem Ereignis. */
  readonly sigma_fb: number;
  /** Poisson-Fehler nach unten und oben (68 %) in fb; bei 0 Ereignissen beide 0. */
  readonly errLow_fb: number;
  readonly errHigh_fb: number;
  /** Bei 0 Ereignissen: Obergrenze (1,84 Ereignisse) in fb, sonst `null`. */
  readonly upperLimit_fb: number | null;
}

export interface RunResult {
  readonly coreVersion: string;
  readonly modelVersion: string;
  readonly settings: Required<RunSettings>;
  /** Wurde gegen eine verdeckte Natur gemessen? */
  readonly hiddenNature: boolean;
  readonly eCm_MeV: number;
  readonly eStar_MeV: number;
  readonly targetNucleiPerCm2: number;
  /** Strahlkerne insgesamt. */
  readonly beamDose: number;
  readonly channels: readonly ChannelResult[];
  /** Detektor-Protokoll, nach Zeit sortiert (höchstens `maxStoredEvents` Einträge). */
  readonly events: readonly DetectorEvent[];
  /** `true`, wenn mehr Ereignisse gezählt als im Protokoll gespeichert wurden. */
  readonly eventsTruncated: boolean;
  readonly analysis: RunAnalysis;
}

export interface RunOptions {
  /** Obergrenze für gespeicherte Protokoll-Einträge (gezählt wird immer alles). */
  readonly maxStoredEvents?: number;
}

/** Strahlenergie im Labor, die zu einer Anregungsenergie E* gehört. */
export function eLabForExcitation(reactionId: string, eStar_MeV: number): number {
  const r = getReaction(reactionId);
  return eLabFromCm(eStar_MeV - r.qValue.value, r.projectile.a, r.target.a);
}

/** Anregungsenergie E* zu einer Strahlenergie im Labor. */
export function excitationForELab(reactionId: string, eLab_MeV: number): number {
  const r = getReaction(reactionId);
  return excitationEnergy(eCmFromLab(eLab_MeV, r.projectile.a, r.target.a), r.qValue.value);
}

function validate(s: RunSettings): void {
  const positive: [string, number][] = [
    ['eLab_MeV', s.eLab_MeV],
    ['beamPerSecond', s.beamPerSecond],
    ['thickness_mg_cm2', s.thickness_mg_cm2],
    ['beamTime_s', s.beamTime_s],
  ];
  for (const [name, v] of positive) {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${name} muss positiv sein (ist ${v})`);
  }
  const sep = s.separatorEfficiency;
  if (sep !== undefined && !(sep > 0 && sep <= 1)) {
    throw new RangeError(`separatorEfficiency muss in (0, 1] liegen (ist ${sep})`);
  }
  if (!Number.isInteger(s.seed)) throw new RangeError(`seed muss eine ganze Zahl sein (ist ${s.seed})`);
}

/**
 * Spielt eine Messung nach: Fusionen als Poisson-Prozess über die Strahlzeit,
 * danach für jeden Kern die Zerfallskette, zuletzt die Auswertung.
 *
 * Vereinfachungen (als Annahmen markiert, siehe README):
 * - Energieverlust und Energiebreite im Target werden nicht gerechnet.
 * - Kein Untergrund: Jede erkannte Kette ist echt.
 * - Die Zuordnung Kette -> Kanal (3n, 4n, ...) ist bekannt; im echten
 *   Experiment liest man sie aus den Zerfallseigenschaften ab.
 */
export function runExperiment(
  settings: RunSettings,
  nature: Nature,
  options: RunOptions = {},
): RunResult {
  validate(settings);
  const reaction = getReaction(settings.reactionId);
  if (nature.reactionId !== reaction.id) {
    throw new Error(`Natur gehört zu ${nature.reactionId}, Messung zu ${reaction.id}`);
  }
  const full: Required<RunSettings> = {
    ...settings,
    separatorEfficiency: settings.separatorEfficiency ?? DEFAULTS.separatorEfficiency.value,
  };
  const maxStored = options.maxStoredEvents ?? 500;

  const eCm = eCmFromLab(full.eLab_MeV, reaction.projectile.a, reaction.target.a);
  const eStar = excitationEnergy(eCm, reaction.qValue.value);
  const sensitivityPerSecond = sensitivityPerSecondPerFb({
    beamPerSecond: full.beamPerSecond,
    thickness_mg_cm2: full.thickness_mg_cm2,
    aTarget: reaction.target.a,
    separatorEfficiency: full.separatorEfficiency,
  });
  const sensitivity = sensitivityPerSecond * full.beamTime_s;

  const events: DetectorEvent[] = [];
  const channels: ChannelResult[] = [];
  let truncated = false;

  for (const ch of nature.channels) {
    // Eigener Zufallsstrom je Kanal: Ein Kanal ändert die Würfe der anderen nicht.
    const rng = mulberry32(deriveSeed(full.seed, ch.neutrons));
    const expected = channelCrossSection_fb(ch, eStar) * sensitivity;
    const implanted = samplePoisson(rng, expected);
    if (ch.residue === null) {
      channels.push({
        neutrons: ch.neutrons,
        residue: null,
        implanted,
        identified: null,
        chainEfficiency: null,
        sigma_fb: null,
      });
      continue;
    }
    let identified = 0;
    for (let i = 0; i < implanted; i++) {
      const time = rng.next() * full.beamTime_s;
      const chain = simulateChain(ch.residue, rng);
      const verdict = judgeChain(chain);
      if (verdict.identified) identified++;
      if (events.length < maxStored) {
        events.push({
          time_s: time,
          neutrons: ch.neutrons,
          residue: ch.residue,
          steps: chain.steps,
          endsAt: chain.endsAt,
          verdict,
        });
      } else {
        truncated = true;
      }
    }
    const eff = chainEfficiency(ch.residue);
    channels.push({
      neutrons: ch.neutrons,
      residue: ch.residue,
      implanted,
      identified,
      chainEfficiency: eff,
      sigma_fb: identified / (sensitivity * eff),
    });
  }
  events.sort((a, b) => a.time_s - b.time_s);

  return {
    coreVersion: CORE_VERSION,
    modelVersion: STAGE1_MODEL_VERSION,
    settings: full,
    hiddenNature: nature.hidden,
    eCm_MeV: eCm,
    eStar_MeV: eStar,
    targetNucleiPerCm2: targetNucleiPerCm2(full.thickness_mg_cm2, reaction.target.a),
    beamDose: full.beamPerSecond * full.beamTime_s,
    channels,
    events,
    eventsTruncated: truncated,
    analysis: analyse(channels, sensitivity),
  };
}

/**
 * Auswertung: sigma = Summe über Kanäle von N_Kanal / (Empfindlichkeit * Ketten-Effizienz).
 * Fehler: Poisson-Grenzen (68 %, Gehrels) auf die Gesamtzahl der Ketten, auf
 * den Wirkungsquerschnitt umgerechnet. Bei 0 Ketten: Obergrenze aus 1,84
 * Ereignissen, mit der kleinsten Ketten-Effizienz gerechnet (vorsichtige Seite).
 */
export function analyse(channels: readonly ChannelResult[], sensitivity_perFb: number): RunAnalysis {
  let chains = 0;
  let sigma = 0;
  let minEff = Infinity;
  const included: number[] = [];
  const open: number[] = [];
  for (const c of channels) {
    if (c.identified === null || c.chainEfficiency === null || c.sigma_fb === null) {
      open.push(c.neutrons);
      continue;
    }
    included.push(c.neutrons);
    chains += c.identified;
    sigma += c.sigma_fb;
    minEff = Math.min(minEff, c.chainEfficiency);
  }
  const interval = poissonInterval(chains);
  if (chains === 0) {
    return {
      chains,
      sensitivity_perFb,
      channelsIncluded: included,
      channelsOpen: open,
      sigma_fb: 0,
      errLow_fb: 0,
      errHigh_fb: 0,
      upperLimit_fb: included.length > 0 ? interval.upper / (sensitivity_perFb * minEff) : null,
    };
  }
  const perEvent = sigma / chains;
  return {
    chains,
    sensitivity_perFb,
    channelsIncluded: included,
    channelsOpen: open,
    sigma_fb: sigma,
    errLow_fb: (chains - interval.lower) * perEvent,
    errHigh_fb: (interval.upper - chains) * perEvent,
    upperLimit_fb: null,
  };
}

/**
 * Fasst mehrere Messungen bei gleicher Energie zu einem Punkt zusammen
 * (Ketten und Empfindlichkeit addieren, dann neu auswerten).
 */
export function combineRuns(runs: readonly RunResult[]): RunAnalysis {
  if (runs.length === 0) throw new Error('combineRuns: keine Messungen');
  const first = runs[0]!;
  const tol = 1e-6;
  let sensitivity = 0;
  const merged = new Map<number, { residue: string | null; implanted: number; identified: number | null; eff: number | null }>();
  for (const r of runs) {
    if (r.settings.reactionId !== first.settings.reactionId || Math.abs(r.eStar_MeV - first.eStar_MeV) > tol) {
      throw new Error('combineRuns: nur Messungen derselben Reaktion und Energie');
    }
    sensitivity += r.analysis.sensitivity_perFb;
    for (const c of r.channels) {
      const m = merged.get(c.neutrons) ?? {
        residue: c.residue,
        implanted: 0,
        identified: c.identified === null ? null : 0,
        eff: c.chainEfficiency,
      };
      m.implanted += c.implanted;
      if (m.identified !== null && c.identified !== null) m.identified += c.identified;
      merged.set(c.neutrons, m);
    }
  }
  const channels: ChannelResult[] = [...merged.entries()].map(([neutrons, m]) => ({
    neutrons,
    residue: m.residue,
    implanted: m.implanted,
    identified: m.identified,
    chainEfficiency: m.eff,
    sigma_fb: m.identified === null || m.eff === null ? null : m.identified / (sensitivity * m.eff),
  }));
  return analyse(channels, sensitivity);
}
