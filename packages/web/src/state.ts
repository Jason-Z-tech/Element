import {
  combineRuns,
  DEFAULT_PARAMETERS,
  DEFAULTS,
  deriveSeed,
  eLabForExcitation,
  getReaction,
  type RunAnalysis,
  type RunResult,
  type Stage1Parameters,
} from '@elementjaeger/core';

export type Mode = 'offen' | 'verdeckt';

export interface Controls {
  readonly eLab_MeV: number;
  readonly beamPerSecond: number;
  readonly thickness_mg_cm2: number;
  readonly days: number;
}

export interface StoredRun {
  readonly id: number;
  /** Messreihe, zu der die Messung gehört (Reaktion, Modus, verdeckte Natur). */
  readonly seriesKey: string;
  /** Breite der Gauß-Kurven, gegen die gemessen wurde (Annahme). */
  readonly width_MeV: number;
  readonly result: RunResult;
}

export interface AppState {
  readonly schema: 1;
  readonly reactionId: string;
  readonly mode: Mode;
  /** Seed der verdeckten Natur. */
  readonly hiddenSeed: number;
  /** Wurde die verdeckte Natur aufgelöst? */
  readonly revealed: boolean;
  /** Tipp des Spielers für die beste Anregungsenergie. */
  readonly guess_eStar: number | null;
  readonly params: Stage1Parameters;
  /** Einstellungen des Steuerpults je Reaktion. */
  readonly controls: Readonly<Record<string, Controls>>;
  readonly runs: readonly StoredRun[];
  /** Aus diesem Seed werden die Seeds der Messungen abgeleitet. */
  readonly baseSeed: number;
  readonly nextRunId: number;
  readonly selectedRunId: number | null;
}

export const STORAGE_KEY = 'elementjaeger.stufe1.v1';

/** Grenzen der Regler. Die Standardwerte sind die des Berkeley-Experiments. */
export const LIMITS = {
  eStar: { min: 24, max: 62 },
  beamPerSecond: { min: 1e12, max: 3e13, step: 1e12 },
  thickness_mg_cm2: { min: 0.1, max: 1, step: 0.01 },
  days: { min: 1, max: 365, step: 1 },
  width_MeV: { min: 2, max: 8, step: 0.5 },
} as const;

export const REACTION_IDS = ['Ti50+Cf249', 'Ti50+Pu244'] as const;

export function defaultControls(reactionId: string): Controls {
  return {
    eLab_MeV: Math.round(eLabForExcitation(reactionId, 41) * 10) / 10,
    beamPerSecond: DEFAULTS.beamPerSecond.value,
    thickness_mg_cm2: DEFAULTS.targetThickness.value,
    days: reactionId === 'Ti50+Pu244' ? 22.1 : 100,
  };
}

export function initialState(baseSeed: number, hiddenSeed: number): AppState {
  return {
    schema: 1,
    reactionId: 'Ti50+Cf249',
    mode: 'offen',
    hiddenSeed: hiddenSeed >>> 0,
    revealed: false,
    guess_eStar: null,
    params: DEFAULT_PARAMETERS,
    controls: Object.fromEntries(REACTION_IDS.map((id) => [id, defaultControls(id)])),
    runs: [],
    baseSeed: baseSeed >>> 0,
    nextRunId: 1,
    selectedRunId: null,
  };
}

/** Verdeckte Natur gibt es nur, wo die Trefferquote eine Vorhersage ist. */
export function hiddenAllowed(reactionId: string): boolean {
  return getReaction(reactionId).basis === 'vorhersage';
}

export function effectiveMode(state: AppState): Mode {
  return hiddenAllowed(state.reactionId) ? state.mode : 'offen';
}

export function seriesKey(state: AppState): string {
  const mode = effectiveMode(state);
  return mode === 'verdeckt' ? `${state.reactionId}|verdeckt|${state.hiddenSeed}` : `${state.reactionId}|offen`;
}

export function currentControls(state: AppState): Controls {
  return state.controls[state.reactionId] ?? defaultControls(state.reactionId);
}

export function currentRuns(state: AppState): StoredRun[] {
  const key = seriesKey(state);
  return state.runs.filter((r) => r.seriesKey === key);
}

/** Q-Wert, mit dem gerade gerechnet wird. */
export function currentQ(state: AppState): number {
  const reaction = getReaction(state.reactionId);
  // Der einstellbare Q-Wert gilt für die Hauptreaktion; der Testlauf behält seinen Wert.
  return state.reactionId === 'Ti50+Cf249' && state.params.qValue_MeV !== null
    ? state.params.qValue_MeV
    : reaction.qValue.value;
}

export function seedForRun(state: AppState): number {
  return deriveSeed(state.baseSeed, state.nextRunId);
}

/** Prüft grob, ob ein gespeicherter Stand zu dieser Version passt. */
export function parseState(text: string | null): AppState | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text) as Partial<AppState>;
    if (s.schema !== 1 || typeof s.reactionId !== 'string' || !Array.isArray(s.runs)) return null;
    if (!REACTION_IDS.includes(s.reactionId as (typeof REACTION_IDS)[number])) return null;
    if (typeof s.baseSeed !== 'number' || typeof s.hiddenSeed !== 'number' || typeof s.nextRunId !== 'number') return null;
    const controls: Record<string, Controls> = {};
    for (const id of REACTION_IDS) controls[id] = { ...defaultControls(id), ...(s.controls?.[id] ?? {}) };
    return {
      schema: 1,
      reactionId: s.reactionId,
      mode: s.mode === 'verdeckt' ? 'verdeckt' : 'offen',
      hiddenSeed: s.hiddenSeed,
      revealed: s.revealed === true,
      guess_eStar: typeof s.guess_eStar === 'number' ? s.guess_eStar : null,
      params: { ...DEFAULT_PARAMETERS, ...(s.params ?? {}) },
      controls,
      runs: s.runs as StoredRun[],
      baseSeed: s.baseSeed,
      nextRunId: s.nextRunId,
      selectedRunId: typeof s.selectedRunId === 'number' ? s.selectedRunId : null,
    };
  } catch {
    return null;
  }
}

/** Ein Punkt der Kurve: alle Messungen mit denselben Einstellungen zusammengefasst. */
export interface MeasuredPoint {
  readonly key: string;
  readonly eStar_MeV: number;
  readonly eLab_MeV: number;
  readonly runIds: readonly number[];
  readonly days: number;
  readonly analysis: RunAnalysis;
}

function groupKey(run: StoredRun): string {
  const s = run.result.settings;
  return [s.eLab_MeV, s.qValue_MeV, s.fl282Decay, run.width_MeV].join('|');
}

/** Messungen bei gleicher Energie (und gleichen Annahmen) zu Punkten zusammenfassen. */
export function measuredPoints(runs: readonly StoredRun[]): MeasuredPoint[] {
  const groups = new Map<string, StoredRun[]>();
  for (const run of runs) {
    const key = groupKey(run);
    const list = groups.get(key);
    if (list) list.push(run);
    else groups.set(key, [run]);
  }
  const points: MeasuredPoint[] = [];
  for (const [key, list] of groups) {
    const first = list[0]!;
    points.push({
      key,
      eStar_MeV: first.result.eStar_MeV,
      eLab_MeV: first.result.settings.eLab_MeV,
      runIds: list.map((r) => r.id),
      days: list.reduce((s, r) => s + r.result.settings.beamTime_s / 86400, 0),
      analysis: list.length === 1 ? first.result.analysis : combineRuns(list.map((r) => r.result)),
    });
  }
  return points.sort((a, b) => a.eStar_MeV - b.eStar_MeV);
}

/** Strahlzeit einer Messreihe in Tagen. */
export function totalDays(runs: readonly StoredRun[]): number {
  return runs.reduce((s, r) => s + r.result.settings.beamTime_s / 86400, 0);
}
