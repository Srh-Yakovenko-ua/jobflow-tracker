import { toApiError } from './api-error';
import { readJsonBody } from './read-json-body';

export const API_CLIENT_LIMITS = { requestTimeoutMs: 15_000 } as const;

export type ResponseMode = 'json' | 'text';

export type SendOptions = {
  url: string;
  init: RequestInit;
  signal?: AbortSignal | undefined;
  response?: ResponseMode | undefined;
};

function timeoutSignals(signal: AbortSignal | undefined) {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, API_CLIENT_LIMITS.requestTimeoutMs);
  const sources = signal === undefined ? [timeout.signal] : [timeout.signal, signal];
  return { signal: AbortSignal.any(sources), timer };
}

export async function send({ url, init, signal, response }: SendOptions): Promise<unknown> {
  const bounded = timeoutSignals(signal);
  try {
    const reply = await fetch(url, { ...init, signal: bounded.signal });
    if (!reply.ok) {
      throw await toApiError(reply);
    }
    return await (response === 'text' ? reply.text() : readJsonBody(reply));
  } finally {
    clearTimeout(bounded.timer);
  }
}
