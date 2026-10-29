import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  errorReply,
  REFRESH_URL,
  SESSION_TOKENS,
  SUGGESTIONS,
  SUGGESTIONS_REQUEST,
  suggestionsSession,
} from '@/test/api-handlers';
import { latch } from '@/test/latch';
import { server } from '@/test/server';

import { API_CLIENT_LIMITS, apiClient, clearAccessToken, setAccessToken } from './index';
import { getAccessToken } from './session';

const REFRESH_REFUSED = { status: 401, type: 'unauthorized', title: 'Session ended' } as const;

async function openTab(token: string) {
  vi.resetModules();
  const tab = await import('@/shared/api');
  tab.setAccessToken(token);
  return tab;
}

function twoWaitingRequests() {
  setAccessToken(SESSION_TOKENS.expired);
  return [apiClient.request(SUGGESTIONS_REQUEST), apiClient.request(SUGGESTIONS_REQUEST)];
}

describe('refreshAccessToken', () => {
  afterEach(() => {
    clearAccessToken();
    vi.useRealTimers();
  });

  it('two tabs with expired tokens refresh one after the other and both succeed', async () => {
    const onRefresh = vi.fn();
    server.use(...suggestionsSession({ onCall: onRefresh, hold: 20 }));
    const firstTab = await openTab('expired-in-first-tab');
    const secondTab = await openTab('expired-in-second-tab');

    const results = await Promise.all(
      [firstTab, secondTab].map((tab) => tab.apiClient.request(SUGGESTIONS_REQUEST)),
    );

    expect(results).toEqual([SUGGESTIONS, SUGGESTIONS]);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('a refresh answered 401 clears the token and rejects every waiting request', async () => {
    server.use(
      http.post(REFRESH_URL, () => errorReply(REFRESH_REFUSED)),
      ...suggestionsSession({}),
    );

    await Promise.all(
      twoWaitingRequests().map((request) =>
        expect(request).rejects.toMatchObject({
          body: {
            status: 401,
            type: 'unauthorized',
            title: 'Session ended',
            requestId: 'req-test',
          },
        }),
      ),
    );

    expect(getAccessToken()).toBeUndefined();
  });

  it('a refresh that never answers rejects the waiting requests and frees the lock for the next refresh', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const refreshStarted = latch();
    server.use(...suggestionsSession({ onCall: refreshStarted.release, hold: 'infinite' }));

    const timedOut = Promise.all(
      twoWaitingRequests().map((request) =>
        expect(request).rejects.toMatchObject({ name: 'TimeoutError' }),
      ),
    );
    await refreshStarted.reached;
    await vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs);
    await timedOut;
    server.use(...suggestionsSession({}));

    await expect(apiClient.request(SUGGESTIONS_REQUEST)).resolves.toEqual(SUGGESTIONS);
    expect(getAccessToken()).toBe(SESSION_TOKENS.fresh);
  });
});
