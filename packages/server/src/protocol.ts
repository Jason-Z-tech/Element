import type { RunResult, RunSettings, stage2 } from '@elementjaeger/core';

/** Nachrichten zwischen Browser und Team-Server (JSON über WebSocket). */

export type CampaignKind = 'element120' | 'element119' | 'alle';

export type ClientMessage =
  | { readonly t: 'create'; readonly name: string }
  | { readonly t: 'join'; readonly lab: string; readonly name: string }
  /** Kampagne starten: Ziel und Zahl der Ziehungen je Ensemble. */
  | { readonly t: 'campaign'; readonly kind: CampaignKind; readonly members: number }
  /** Ein Worker ist frei und bittet um ein Paket. */
  | { readonly t: 'ready' }
  | { readonly t: 'result'; readonly job: number; readonly packet: number; readonly values: number[]; readonly ms: number }
  /** Stufe 1: Messung für die gemeinsame Messreihe. Der Server rechnet sie selbst. */
  | { readonly t: 'run'; readonly settings: RunSettings }
  /** Stufe 1: neue gemeinsame Messreihe; `hidden` = verdeckte Natur. */
  | { readonly t: 'series'; readonly hidden: boolean }
  | { readonly t: 'reveal' };

export interface PlayerView {
  readonly id: string;
  readonly name: string;
  readonly online: boolean;
  /** Bestätigte Ziehungen, an denen der Spieler beteiligt war. */
  readonly draws: number;
  /** Ziehungen pro Sekunde (gleitend). */
  readonly rate: number;
  /** Pakete, bei denen das Ergebnis des Spielers von zwei anderen abwich. */
  readonly rejected: number;
}

export interface JobView {
  readonly reactionId: string;
  readonly label: string;
  readonly element: number;
  readonly eStar_MeV: number;
  readonly members: number;
  /** Ziehungen, die von zwei verschiedenen Spielern gleich gerechnet wurden. */
  readonly verified: number;
  /** Ziehungen, die erst einmal gerechnet wurden. */
  readonly single: number;
  /** Summe der Kanäle 2n bis 5n in fb aus den bestätigten Ziehungen; `null`, solange es zu wenige sind. */
  readonly median_fb: number | null;
  readonly low_fb: number | null;
  readonly high_fb: number | null;
  /** Statistische Unsicherheit des Medians in Prozent; schrumpft mit jedem Paket. */
  readonly medianError_percent: number | null;
}

export interface CampaignView {
  readonly kind: CampaignKind;
  readonly membersPerJob: number;
  readonly jobs: readonly JobView[];
  readonly totalDraws: number;
  readonly verifiedDraws: number;
  readonly singleDraws: number;
}

export interface SeriesView {
  readonly reactionId: string;
  readonly hidden: boolean;
  readonly revealed: boolean;
  /** Seed der verdeckten Natur; erst nach dem Auflösen. */
  readonly hiddenSeed: number | null;
  readonly runs: readonly { readonly id: number; readonly player: string; readonly result: RunResult }[];
}

export interface LabView {
  readonly id: string;
  readonly players: readonly PlayerView[];
  /** Ziehungen pro Sekunde im ganzen Team. */
  readonly teamRate: number;
  readonly campaign: CampaignView | null;
  readonly series: SeriesView;
  readonly modelVersion: string;
}

export type ServerMessage =
  | { readonly t: 'welcome'; readonly you: string; readonly state: LabView }
  | { readonly t: 'state'; readonly state: LabView }
  | { readonly t: 'work'; readonly job: number; readonly packet: number; readonly reaction: stage2.Reaction2; readonly spec: stage2.EnsemblePacket }
  /** Gerade kein Paket für diesen Spieler; später wieder fragen. */
  | { readonly t: 'idle' }
  | { readonly t: 'error'; readonly message: string };
