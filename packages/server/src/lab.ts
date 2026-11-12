import {
  getReaction,
  hiddenNature,
  publishedNature,
  runExperiment,
  stage2,
  type RunResult,
  type RunSettings,
} from '@elementjaeger/core';
import type { CampaignKind, CampaignView, JobView, LabView, PlayerView, SeriesView } from './protocol';

/** Ziehungen je Paket. */
export const PACKET_SIZE = 10;
/** Nach so vielen Millisekunden gilt ein vergebenes Paket als verloren und wird neu vergeben. */
export const ASSIGNMENT_TIMEOUT_MS = 120_000;
/** Reaktion der gemeinsamen Messreihe von Stufe 1. */
const SERIES_REACTION = 'Ti50+Cf249';

interface Player {
  readonly id: string;
  name: string;
  online: boolean;
  draws: number;
  rejected: number;
  /** Zeitpunkte und Größen der letzten Abgaben, für die Rate. */
  recent: { at: number; draws: number }[];
}

interface Submission {
  readonly player: string;
  readonly values: Float64Array;
}

interface Packet {
  readonly firstMember: number;
  readonly members: number;
  /** Spieler, die das Paket gerade rechnen, mit Zeitpunkt der Vergabe. */
  assigned: Map<string, number>;
  submissions: Submission[];
  /** Das von zwei Spielern übereinstimmend gelieferte Ergebnis. */
  verified: Float64Array | null;
}

interface Job {
  readonly job: stage2.PredictionJob;
  readonly reaction: stage2.PredictionReaction;
  readonly members: number;
  readonly packets: Packet[];
}

export interface Assignment {
  readonly job: number;
  readonly packet: number;
  readonly reaction: stage2.Reaction2;
  readonly spec: stage2.EnsemblePacket;
}

export interface SubmitOutcome {
  readonly accepted: boolean;
  readonly verified: boolean;
  /** Das Ergebnis wich von einem anderen ab. */
  readonly conflict: boolean;
}

function sameValues(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // Bitgleich: Die Rechnung ist deterministisch, jede Abweichung ist ein Fehler oder eine Fälschung.
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Ein Labor: Spieler, eine Kampagne von Stufe 2 und eine gemeinsame Messreihe
 * von Stufe 1. Reine Logik ohne Netzwerk, damit sie sich testen lässt.
 */
export class Lab {
  readonly id: string;
  private readonly players = new Map<string, Player>();
  private campaignKind: CampaignKind | null = null;
  private membersPerJob = 0;
  private jobs: Job[] = [];
  private seriesHidden = false;
  private seriesRevealed = false;
  private seriesSeed: number;
  private runs: { id: number; player: string; result: RunResult }[] = [];
  private nextRunId = 1;

  constructor(id: string, seed: number) {
    this.id = id;
    this.seriesSeed = seed >>> 0;
  }

  join(id: string, name: string): void {
    const clean = name.trim().slice(0, 24) || 'Gast';
    const existing = this.players.get(id);
    if (existing) {
      existing.online = true;
      existing.name = clean;
    } else {
      this.players.set(id, { id, name: clean, online: true, draws: 0, rejected: 0, recent: [] });
    }
  }

  leave(id: string): void {
    const p = this.players.get(id);
    if (p) p.online = false;
    for (const job of this.jobs) for (const packet of job.packets) packet.assigned.delete(id);
  }

  get onlineCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.online) n++;
    return n;
  }

  /** Startet eine Kampagne: alle Ensembles des gewählten Ziels. */
  startCampaign(kind: CampaignKind, members: number): void {
    const perJob = Math.max(PACKET_SIZE, Math.min(10_000, Math.round(members / PACKET_SIZE) * PACKET_SIZE));
    const wanted = stage2.predictionJobs().filter((j) => {
      const element = stage2.getPredictionReaction(j.reactionId).element;
      return kind === 'alle' || (kind === 'element120' ? element === 120 : element === 119);
    });
    this.campaignKind = kind;
    this.membersPerJob = perJob;
    this.jobs = wanted.map((job) => {
      const packets: Packet[] = [];
      for (let first = 0; first < perJob; first += PACKET_SIZE) {
        packets.push({ firstMember: first, members: PACKET_SIZE, assigned: new Map(), submissions: [], verified: null });
      }
      return { job, reaction: stage2.getPredictionReaction(job.reactionId), members: perJob, packets };
    });
  }

  /**
   * Nächstes Paket für einen Spieler. Vorrang haben Pakete, die schon einmal
   * gerechnet sind und eine Bestätigung durch einen anderen Spieler brauchen.
   * Kein Spieler bekommt dasselbe Paket zweimal.
   */
  nextPacket(playerId: string, now: number): Assignment | null {
    let fallback: { j: number; p: number } | null = null;
    for (let j = 0; j < this.jobs.length; j++) {
      const packets = this.jobs[j]!.packets;
      for (let p = 0; p < packets.length; p++) {
        const packet = packets[p]!;
        if (packet.verified) continue;
        for (const [who, at] of packet.assigned) if (now - at > ASSIGNMENT_TIMEOUT_MS) packet.assigned.delete(who);
        if (packet.assigned.has(playerId) || packet.submissions.some((s) => s.player === playerId)) continue;
        // Gebraucht werden zwei übereinstimmende Ergebnisse. Laufende Vergaben zählen mit;
        // widersprechen sich zwei Ergebnisse, rechnet ein weiterer Spieler.
        const results = packet.submissions.length;
        const open = results >= 2 ? packet.assigned.size < 1 : results + packet.assigned.size < 2;
        if (!open) continue;
        if (packet.submissions.length >= 1) return this.assign(j, p, playerId, now);
        if (!fallback) fallback = { j, p };
      }
    }
    return fallback ? this.assign(fallback.j, fallback.p, playerId, now) : null;
  }

  private assign(j: number, p: number, playerId: string, now: number): Assignment {
    const job = this.jobs[j]!;
    const packet = job.packets[p]!;
    packet.assigned.set(playerId, now);
    return {
      job: j,
      packet: p,
      reaction: { id: job.reaction.id, projectile: job.reaction.projectile, target: job.reaction.target },
      spec: stage2.predictionPacket(job.job, packet.firstMember, packet.members),
    };
  }

  /** Nimmt ein Ergebnis an und vergleicht es mit den anderen Ergebnissen desselben Pakets. */
  submit(playerId: string, j: number, p: number, values: readonly number[], now: number): SubmitOutcome {
    const packet = this.jobs[j]?.packets[p];
    const player = this.players.get(playerId);
    if (!packet || !player) return { accepted: false, verified: false, conflict: false };
    if (!packet.assigned.has(playerId) || packet.submissions.some((s) => s.player === playerId)) {
      return { accepted: false, verified: false, conflict: false };
    }
    packet.assigned.delete(playerId);
    if (values.length !== packet.members * stage2.MAX_NEUTRONS || values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      player.rejected++;
      return { accepted: false, verified: false, conflict: true };
    }
    player.recent.push({ at: now, draws: packet.members });
    if (packet.verified) return { accepted: true, verified: true, conflict: !sameValues(packet.verified, Float64Array.from(values)) };
    const mine = Float64Array.from(values);
    const match = packet.submissions.find((s) => sameValues(s.values, mine));
    packet.submissions.push({ player: playerId, values: mine });
    if (!match) return { accepted: true, verified: false, conflict: packet.submissions.length > 1 };
    packet.verified = mine;
    for (const s of packet.submissions) {
      const other = this.players.get(s.player);
      if (!other) continue;
      if (sameValues(s.values, mine)) other.draws += packet.members;
      else other.rejected++;
    }
    return { accepted: true, verified: true, conflict: false };
  }

  /** Stufe 1: neue gemeinsame Messreihe. */
  startSeries(hidden: boolean, seed: number): void {
    this.seriesHidden = hidden;
    this.seriesRevealed = false;
    this.seriesSeed = seed >>> 0;
    this.runs = [];
  }

  revealSeries(): void {
    if (this.seriesHidden) this.seriesRevealed = true;
  }

  /**
   * Stufe 1: Messung für die gemeinsame Kurve. Der Server rechnet sie selbst aus
   * den Einstellungen; so kann niemand ein falsches Ergebnis einschleusen, und die
   * verdeckte Natur bleibt auf dem Server.
   */
  addRun(playerId: string, settings: RunSettings): RunResult {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Unbekannter Spieler');
    if (this.seriesHidden && this.seriesRevealed) throw new Error('Die Messreihe ist aufgelöst und abgeschlossen');
    if (settings.reactionId !== SERIES_REACTION) throw new Error('Die gemeinsame Messreihe misst 50Ti + 249Cf');
    if (!(settings.beamTime_s > 0 && settings.beamTime_s <= 366 * 86400)) throw new Error('Strahlzeit je Messung: höchstens 365 Tage');
    if (!(settings.beamPerSecond > 0 && settings.beamPerSecond <= 3e13)) throw new Error('Strahlstärke außerhalb des erlaubten Bereichs');
    if (!(settings.thickness_mg_cm2 > 0 && settings.thickness_mg_cm2 <= 1)) throw new Error('Targetdicke außerhalb des erlaubten Bereichs');
    const reaction = getReaction(SERIES_REACTION);
    const nature = this.seriesHidden ? hiddenNature(reaction, this.seriesSeed) : publishedNature(reaction);
    const result = runExperiment(
      { reactionId: SERIES_REACTION, eLab_MeV: settings.eLab_MeV, beamPerSecond: settings.beamPerSecond, thickness_mg_cm2: settings.thickness_mg_cm2, beamTime_s: settings.beamTime_s, seed: settings.seed },
      nature,
      { maxStoredEvents: 50 },
    );
    this.runs.push({ id: this.nextRunId++, player: player.name, result });
    return result;
  }

  private jobView(job: Job): JobView {
    let verified = 0;
    let single = 0;
    const sums: number[] = [];
    for (const packet of job.packets) {
      if (packet.verified) {
        verified += packet.members;
        for (let m = 0; m < packet.members; m++) {
          let s = 0;
          for (let x = 2; x <= 5; x++) s += packet.verified[m * stage2.MAX_NEUTRONS + x - 1]!;
          sums.push(s * 1000);
        }
      } else if (packet.submissions.length > 0) {
        single += packet.members;
      }
    }
    let median: number | null = null;
    let low: number | null = null;
    let high: number | null = null;
    let error: number | null = null;
    if (sums.length >= 20) {
      sums.sort((a, b) => a - b);
      const q = (f: number): number => sums[Math.min(sums.length - 1, Math.round(f * (sums.length - 1)))]!;
      median = q(0.5);
      low = q(0.1587);
      high = q(0.8413);
      if (low > 0 && high > 0) {
        // Standardfehler des Medians einer Normalverteilung im Logarithmus: 1,2533 σ / √n
        const sigmaLog = (Math.log(high) - Math.log(low)) / 2;
        error = 100 * (Math.exp((1.2533 * sigmaLog) / Math.sqrt(sums.length)) - 1);
      }
    }
    return {
      reactionId: job.reaction.id,
      label: job.reaction.label,
      element: job.reaction.element,
      eStar_MeV: job.job.eStar_MeV,
      members: job.members,
      verified,
      single,
      median_fb: median,
      low_fb: low,
      high_fb: high,
      medianError_percent: error,
    };
  }

  view(now: number): LabView {
    const players: PlayerView[] = [];
    let teamRate = 0;
    for (const p of this.players.values()) {
      p.recent = p.recent.filter((r) => now - r.at <= 20_000);
      const rate = p.online ? p.recent.reduce((s, r) => s + r.draws, 0) / 20 : 0;
      teamRate += rate;
      players.push({ id: p.id, name: p.name, online: p.online, draws: p.draws, rate, rejected: p.rejected });
    }
    let campaign: CampaignView | null = null;
    if (this.campaignKind) {
      const jobs = this.jobs.map((j) => this.jobView(j));
      campaign = {
        kind: this.campaignKind,
        membersPerJob: this.membersPerJob,
        jobs,
        totalDraws: jobs.reduce((s, j) => s + j.members, 0),
        verifiedDraws: jobs.reduce((s, j) => s + j.verified, 0),
        singleDraws: jobs.reduce((s, j) => s + j.single, 0),
      };
    }
    const series: SeriesView = {
      reactionId: SERIES_REACTION,
      hidden: this.seriesHidden,
      revealed: this.seriesRevealed,
      hiddenSeed: this.seriesHidden && this.seriesRevealed ? this.seriesSeed : null,
      runs: this.runs,
    };
    return { id: this.id, players, teamRate, campaign, series, modelVersion: stage2.STAGE2_MODEL_VERSION };
  }
}
