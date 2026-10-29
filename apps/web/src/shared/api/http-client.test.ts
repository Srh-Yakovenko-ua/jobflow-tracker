import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';

import { logger } from '@/shared/lib/logger';
import {
  analyticsUrl,
  apiUrl,
  errorReply,
  expiringRoute,
  REFRESH_URL,
  refreshRoute,
  SESSION_TOKENS,
  SUGGESTIONS,
  SUGGESTIONS_REQUEST,
  suggestionsSession,
  TOKEN_EXPIRED,
} from '@/test/api-handlers';
import { latch } from '@/test/latch';
import { server } from '@/test/server';

import {
  analyticsClient,
  API_CLIENT_LIMITS,
  apiClient,
  ApiError,
  clearAccessToken,
  refreshAccessToken,
  setAccessToken,
} from './index';

const SUGGESTIONS_URL = apiUrl(SUGGESTIONS_REQUEST.path);
const FUNNEL_URL = analyticsUrl('/funnel');

function recordSentCredentials() {
  const sentFetch = vi.spyOn(globalThis, 'fetch');
  return () => sentFetch.mock.calls.map(([url, init]) => [url, init?.credentials]);
}

describe('apiClient', () => {
  beforeEach(() => {
    setAccessToken(SESSION_TOKENS.expired);
  });

  afterEach(() => {
    clearAccessToken();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ten parallel requests with an expired token share one refresh and all succeed', async () => {
    const onRefresh = vi.fn();
    server.use(...suggestionsSession({ onCall: onRefresh }));

    const results = await Promise.all(
      Array.from({ length: 10 }, () => apiClient.request(SUGGESTIONS_REQUEST)),
    );

    expect(results).toEqual(Array.from({ length: 10 }, () => SUGGESTIONS));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a 401 that arrives after the refresh finished retries with the new token without a second refresh', async () => {
    const onRefresh = vi.fn();
    const lateAnswer = latch();
    server.use(
      http.get(
        SUGGESTIONS_URL,
        async () => {
          await lateAnswer.reached;
          return errorReply(TOKEN_EXPIRED);
        },
        { once: true },
      ),
      ...suggestionsSession({ onCall: onRefresh }),
    );

    const late = apiClient.request(SUGGESTIONS_REQUEST);
    await refreshAccessToken();
    lateAnswer.release();

    await expect(late).resolves.toEqual(SUGGESTIONS);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a retry that gets 401 again rejects with ApiError 401 after one refresh', async () => {
    const onRefresh = vi.fn();
    server.use(
      refreshRoute({ token: SESSION_TOKENS.fresh, onCall: onRefresh }),
      expiringRoute({ url: SUGGESTIONS_URL, freshToken: 'never-issued', body: SUGGESTIONS }),
    );

    const request = apiClient.request(SUGGESTIONS_REQUEST);

    await expect(request).rejects.toThrow(ApiError);
    await expect(request).rejects.toMatchObject({ body: { status: 401, type: 'token_expired' } });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a response that breaks its schema logs the zod issues with method and path and rejects', async () => {
    const logError = vi.spyOn(logger, 'error').mockReturnValue(undefined);
    setAccessToken(SESSION_TOKENS.fresh);
    server.use(
      expiringRoute({
        url: SUGGESTIONS_URL,
        freshToken: SESSION_TOKENS.fresh,
        body: { ...SUGGESTIONS, silenceDays: '7' },
      }),
    );

    await expect(apiClient.request(SUGGESTIONS_REQUEST)).rejects.toThrow(ZodError);
    expect(logError).toHaveBeenCalledWith(
      {
        method: 'GET',
        path: '/settings/suggestions',
        issues: '✖ Invalid input: expected number, received string\n  → at silenceDays',
      },
      'API response does not match its schema',
    );
  });

  it('a 204 parsed with z.void() resolves undefined', async () => {
    server.use(http.post(apiUrl('/auth/logout'), () => new HttpResponse(null, { status: 204 })));

    const request = apiClient.request({ path: '/auth/logout', method: 'POST', schema: z.void() });

    await expect(request).resolves.toBeUndefined();
  });

  it('a refused connection rejects with TypeError and calls no refresh', async () => {
    const onRefresh = vi.fn();
    server.use(
      refreshRoute({ token: SESSION_TOKENS.fresh, onCall: onRefresh }),
      http.get(SUGGESTIONS_URL, () => HttpResponse.error()),
    );

    await expect(apiClient.request(SUGGESTIONS_REQUEST)).rejects.toThrow(TypeError);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('a request that never answers rejects with TimeoutError after API_CLIENT_LIMITS.requestTimeoutMs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    server.use(http.get(SUGGESTIONS_URL, () => delay('infinite')));

    const timedOut = expect(apiClient.request(SUGGESTIONS_REQUEST)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs);

    await timedOut;
  });

  it('the analytics client sends the same bearer and refreshes through the API on token_expired', async () => {
    const onRefresh = vi.fn();
    const sentCredentials = recordSentCredentials();
    server.use(
      refreshRoute({ token: SESSION_TOKENS.fresh, onCall: onRefresh }),
      expiringRoute({ url: FUNNEL_URL, freshToken: SESSION_TOKENS.fresh }),
    );

    const request = analyticsClient.request({ path: '/funnel', schema: z.void() });

    await expect(request).resolves.toBeUndefined();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(sentCredentials()).toEqual([
      [FUNNEL_URL, 'omit'],
      [REFRESH_URL, 'include'],
      [FUNNEL_URL, 'omit'],
    ]);
  });

  it('the API client sends every request and the refresh with credentials include', async () => {
    const sentCredentials = recordSentCredentials();
    server.use(...suggestionsSession({}));

    await apiClient.request(SUGGESTIONS_REQUEST);

    expect(sentCredentials()).toEqual([
      [SUGGESTIONS_URL, 'include'],
      [REFRESH_URL, 'include'],
      [SUGGESTIONS_URL, 'include'],
    ]);
  });

  it('keeps the access token out of localStorage and sessionStorage', async () => {
    server.use(...suggestionsSession({}));

    await apiClient.request(SUGGESTIONS_REQUEST);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
