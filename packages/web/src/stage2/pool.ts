import { stage2 } from '@elementjaeger/core';
import type { PacketRequest, PacketResponse } from './worker2';

export interface EnsembleJob {
  readonly reaction: stage2.Reaction2;
  readonly energies: readonly number[];
  readonly seed: number;
  readonly members: number;
  readonly cascades: number;
  /** Schon gerechnete Pakete (erste Ziehung -> Werte); sie werden übernommen statt neu gerechnet. */
  readonly done?: ReadonlyMap<number, Float64Array>;
  /** Wird für jedes neu gerechnete Paket aufgerufen (zum Speichern im Browser). */
  readonly onPacket?: (firstMember: number, values: Float64Array) => void;
}

export interface EnsembleProgress {
  readonly done: number;
  readonly total: number;
  /** Ziehungen pro Sekunde über alle Worker. */
  readonly rate: number;
  readonly workers: number;
}

/** Zahl der Ziehungen je Paket. */
export const PACKET_SIZE = 10;

/**
 * Verteilt ein Ensemble auf einen Worker je CPU-Kern. Jede Ziehung hängt nur von
 * (Seed, Nummer) ab; das Ergebnis ist deshalb unabhängig von der Zahl der Worker.
 */
export function runEnsemble(job: EnsembleJob, onProgress: (p: EnsembleProgress) => void): { promise: Promise<Float64Array>; cancel(): void } {
  const workerCount = Math.max(1, Math.min(navigator.hardwareConcurrency || 2, Math.ceil(job.members / PACKET_SIZE)));
  const startedWith = job.done ? job.done.size * PACKET_SIZE : 0;
  const workers: Worker[] = [];
  let cancelled = false;
  const promise = new Promise<Float64Array>((resolve, reject) => {
    const out = new Float64Array(job.members * stage2.MAX_NEUTRONS);
    let next = 0;
    let done = 0;
    const todo: number[] = [];
    for (let first = 0; first < job.members; first += PACKET_SIZE) {
      const known = job.done?.get(first);
      if (known) {
        out.set(known, first * stage2.MAX_NEUTRONS);
        done += known.length / stage2.MAX_NEUTRONS;
      } else {
        todo.push(first);
      }
    }
    if (todo.length === 0) {
      resolve(out);
      return;
    }
    const start = Date.now();
    const fail = (message: string) => {
      workers.forEach((w) => w.terminate());
      reject(new Error(message));
    };
    const assign = (worker: Worker) => {
      if (cancelled || next >= todo.length) return;
      const firstMember = todo[next++]!;
      const members = Math.min(PACKET_SIZE, job.members - firstMember);
      const request: PacketRequest = {
        id: firstMember,
        reaction: job.reaction,
        packet: { reactionId: job.reaction.id, energies: job.energies, seed: job.seed, firstMember, members, cascades: job.cascades },
      };
      worker.postMessage(request);
    };
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(new URL('./worker2.ts', import.meta.url), { type: 'module' });
      workers.push(worker);
      worker.onerror = () => fail('Worker konnte nicht gestartet werden');
      worker.onmessage = (event: MessageEvent<PacketResponse>) => {
        const r = event.data;
        if (!r.ok) return fail(r.error);
        out.set(r.values, r.id * stage2.MAX_NEUTRONS);
        done += r.values.length / stage2.MAX_NEUTRONS;
        job.onPacket?.(r.id, r.values);
        onProgress({ done, total: job.members, rate: (done - startedWith) / Math.max(0.001, (Date.now() - start) / 1000), workers: workerCount });
        if (done >= job.members) {
          workers.forEach((w) => w.terminate());
          resolve(out);
        } else {
          assign(worker);
        }
      };
      assign(worker);
    }
  });
  return {
    promise,
    cancel() {
      cancelled = true;
      workers.forEach((w) => w.terminate());
    },
  };
}
