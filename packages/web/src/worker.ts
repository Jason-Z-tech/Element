import { simulate, type RunRequest } from './simulate';

export interface WorkerRequest {
  readonly id: number;
  readonly request: RunRequest;
}

export type WorkerResponse =
  | { readonly id: number; readonly ok: true; readonly result: ReturnType<typeof simulate> }
  | { readonly id: number; readonly ok: false; readonly error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

scope.onmessage = (event) => {
  const { id, request } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: simulate(request) });
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
