import {
  getReaction,
  hiddenNature,
  publishedNature,
  runExperiment,
  type Nature,
  type RunResult,
  type RunSettings,
} from '@elementjaeger/core';

/** Beschreibung der Natur, gegen die gemessen wird. Läuft so durch den Worker. */
export interface NatureSpec {
  readonly reactionId: string;
  /** Seed der verdeckten Natur; `null` = veröffentlichte Werte. */
  readonly hiddenSeed: number | null;
  /** Breite der Gauß-Kurven in MeV (Annahme). */
  readonly width_MeV: number;
}

export interface RunRequest {
  readonly settings: RunSettings;
  readonly nature: NatureSpec;
}

/** Höchstzahl gespeicherter Protokoll-Einträge je Messung. */
export const MAX_STORED_EVENTS = 200;

export function buildNature(spec: NatureSpec): Nature {
  const reaction = getReaction(spec.reactionId);
  return spec.hiddenSeed === null
    ? publishedNature(reaction, spec.width_MeV)
    : hiddenNature(reaction, spec.hiddenSeed, spec.width_MeV);
}

/** Eine Messung rechnen. Reine Funktion: läuft im Worker und zur Not im Hauptfaden. */
export function simulate(request: RunRequest): RunResult {
  return runExperiment(request.settings, buildNature(request.nature), { maxStoredEvents: MAX_STORED_EVENTS });
}
