import { stage2 } from '@elementjaeger/core';

/** Ein Rechenpaket von Stufe 2: Ziehungen eines Unsicherheits-Ensembles. */
export interface PacketRequest {
  readonly id: number;
  readonly reaction: stage2.Reaction2;
  readonly packet: stage2.EnsemblePacket;
}

export type PacketResponse =
  | { readonly id: number; readonly ok: true; readonly values: Float64Array; readonly ms: number }
  | { readonly id: number; readonly ok: false; readonly error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PacketRequest>) => void) | null;
  postMessage(message: PacketResponse, transfer?: Transferable[]): void;
};

// Barrieren je Reaktion nur einmal rechnen.
const prepared = new Map<string, stage2.PreparedReaction>();

scope.onmessage = (event) => {
  const { id, reaction, packet } = event.data;
  try {
    const start = Date.now();
    let prep = prepared.get(reaction.id);
    if (!prep) {
      prep = stage2.prepareReaction(reaction, stage2.STAGE2_PARAMETERS);
      prepared.set(reaction.id, prep);
    }
    const values = stage2.runEnsemblePacket(prep, packet);
    scope.postMessage({ id, ok: true, values, ms: Date.now() - start }, [values.buffer]);
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
