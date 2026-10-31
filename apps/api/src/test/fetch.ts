import { vi } from 'vitest';

export type FetchReply = (init: RequestInit | undefined) => Response | Promise<Response>;

export type FetchCall<Body = unknown> = { url: string; headers: Headers; body: Body };

export type RecordFetchOptions<Body> = {
  replies: FetchReply | Record<string, FetchReply>;
  decodeBody: (body: RequestInit['body']) => Body;
};

export function recordFetch<Body>({ replies, decodeBody }: RecordFetchOptions<Body>) {
  const calls: FetchCall<Body>[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({ url, headers: new Headers(init?.headers), body: decodeBody(init?.body) });
    const reply = typeof replies === 'function' ? replies : replies[url];
    return reply ? Promise.resolve(reply(init)) : Promise.reject(new Error(`No fake for ${url}`));
  });
  return calls;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('aborted');
}

export const stalled: FetchReply = (init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    signal.addEventListener('abort', () => {
      reject(abortReason(signal));
    });
  });

export const refusedConnection = new TypeError('fetch failed', {
  cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }),
});

export function timeOutAtOnce() {
  const timedOut = AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError'));
  return vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timedOut);
}
