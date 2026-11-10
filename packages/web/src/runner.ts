import type { RunResult } from '@elementjaeger/core';
import { simulate, type RunRequest } from './simulate';
import type { WorkerRequest, WorkerResponse } from './worker';

export interface Runner {
  run(request: RunRequest): Promise<RunResult>;
  /** `true`, wenn im Web Worker gerechnet wird. */
  readonly usesWorker: boolean;
}

/**
 * Rechnet Messungen in einem Web Worker, damit die Oberfläche flüssig bleibt.
 * Ohne Worker-Unterstützung wird im Hauptfaden gerechnet (gleiches Ergebnis).
 */
export function createRunner(): Runner {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (!worker) {
    return { usesWorker: false, run: (request) => Promise.resolve().then(() => simulate(request)) };
  }
  const pending = new Map<number, { resolve: (r: RunResult) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let broken = false;
  const w = worker;
  w.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.ok) entry.resolve(event.data.result);
    else entry.reject(new Error(event.data.error));
  };
  w.onerror = () => {
    // Worker ließ sich nicht laden: offene Aufträge im Hauptfaden nachholen.
    broken = true;
    for (const [, entry] of pending) entry.reject(new Error('Worker nicht verfügbar'));
    pending.clear();
  };
  return {
    usesWorker: true,
    run(request) {
      if (broken) return Promise.resolve().then(() => simulate(request));
      return new Promise<RunResult>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        const message: WorkerRequest = { id, request };
        w.postMessage(message);
      }).catch((error: unknown) => {
        if (broken) return simulate(request);
        throw error;
      });
    },
  };
}
