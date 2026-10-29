import { toApiError } from './api-error';
import { readJsonBody } from './read-json-body';

export const API_CLIENT_LIMITS = { requestTimeoutMs: 15_000 } as const;

export type SendOptions = {
  url: string;
  init: RequestInit;
  signal?: AbortSignal | undefined;
};

function timeoutSignals(signal: AbortSignal | undefined) {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, API_CLIENT_LIMITS.requestTimeoutMs);
  const sources = signal === undefined ? [timeout.signal] : [timeout.signal, signal];
  return { signal: AbortSignal.any(sources), timer };
}

export async function send({ url, init, signal }: SendOptions): Promise<unknown> {
  const bounded = timeoutSignals(signal);
  try {
    const response = await fetch(url, { ...init, signal: bounded.signal });
    if (!response.ok) {
      throw await toApiError(response);
    }
    return await readJsonBody(response);
  } finally {
    clearTimeout(bounded.timer);
  }
}
