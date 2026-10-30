import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  freshSuggestionsRoute,
  OUTAGES,
  recordSentRequests,
  REFRESH_URL,
  refreshRoute,
  SESSION_TOKENS,
  SUGGESTIONS,
  SUGGESTIONS_REQUEST,
  suggestionsSession,
} from '@/test/api-handlers';
import { latch } from '@/test/latch';
import { server } from '@/test/server';

import {
  API_CLIENT_LIMITS,
  apiClient,
  clearAccessToken,
  ensureAccessToken,
  onSessionEnd,
  refreshAccessToken,
  setAccessToken,
} from './index';
import { getAccessToken } from './session';

const SESSION_MARKER = 'jobflow_session=1';

const unsubscribers: (() => void)[] = [];

function listenForSessionEnd() {
  const listener = vi.fn();
  unsubscribers.push(onSessionEnd(listener));
  return listener;
}

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

afterEach(() => {
  clearAccessToken();
  for (const unsubscribe of unsubscribers.splice(0)) {
    unsubscribe();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('refreshAccessToken', () => {
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

  it('a refresh answered 401 clears the token and the marker, rejects every waiting request and ends the session once', async () => {
    const onSessionEnded = listenForSessionEnd();
    server.use(freshSuggestionsRoute());

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
    expect(document.cookie).not.toContain(SESSION_MARKER);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
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

  it('a successful refresh writes the session marker', async () => {
    server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));

    await refreshAccessToken();

    expect(document.cookie).toContain(SESSION_MARKER);
  });
});

describe('session marker', () => {
  it('setAccessToken writes the marker and clearAccessToken removes it', () => {
    setAccessToken(SESSION_TOKENS.fresh);
    expect(document.cookie).toContain(SESSION_MARKER);

    clearAccessToken();
    expect(document.cookie).not.toContain(SESSION_MARKER);
  });
});

describe('onSessionEnd', () => {
  it.each(OUTAGES)('a refresh that $name keeps the session and its marker', async ({ reply }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onSessionEnded = listenForSessionEnd();
    setAccessToken(SESSION_TOKENS.expired);
    server.use(http.post(REFRESH_URL, reply));

    const failed = expect(refreshAccessToken()).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs);
    await failed;

    expect(onSessionEnded).not.toHaveBeenCalled();
    expect(document.cookie).toContain(SESSION_MARKER);
  });

  it('stays silent after unsubscribe', async () => {
    const onSessionEnded = vi.fn();
    onSessionEnd(onSessionEnded)();

    await expect(refreshAccessToken()).rejects.toMatchObject({ status: 401 });

    expect(onSessionEnded).not.toHaveBeenCalled();
  });
});

describe('ensureAccessToken', () => {
  it('hands back the held token without a request', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    const sentRequests = recordSentRequests();

    await expect(ensureAccessToken()).resolves.toBe(SESSION_TOKENS.fresh);

    expect(sentRequests()).toEqual([]);
  });

  it('refreshes from the cookie when no token is held', async () => {
    server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));

    await expect(ensureAccessToken()).resolves.toBe(SESSION_TOKENS.fresh);
  });
});
