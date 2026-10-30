import {
  type ErrorResponse,
  type SessionTokens,
  type SettingsSuggestions,
  settingsSuggestionsSchema,
} from '@jobflow/shared';
import type { DelayMode, JsonBodyType } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { vi } from 'vitest';

import { ApiError } from '@/shared/api';
import { config } from '@/shared/config';

export type ErrorBodyOptions = Pick<ErrorResponse, 'status' | 'type'> &
  Partial<Omit<ErrorResponse, 'status' | 'type'>>;

export type RefreshRouteOptions = {
  token: string;
  onCall?: () => void;
  hold?: number | DelayMode;
};

export type ExpiringRouteOptions = {
  url: string;
  freshToken: string;
  body?: JsonBodyType;
};

export const SESSION_TOKENS = {
  expired: 'expired-access-token',
  fresh: 'fresh-access-token',
} as const;

export const TOKEN_EXPIRED = {
  status: 401,
  type: 'token_expired',
  title: 'Token expired',
} as const;

export const SUGGESTIONS: SettingsSuggestions = {
  silenceDays: 14,
  medianResponseDays: 6,
  answeredApplications: 12,
};

export const SUGGESTIONS_REQUEST = {
  path: '/settings/suggestions',
  schema: settingsSuggestionsSchema,
} as const;

export function apiUrl(path: string): string {
  return `${config.apiBaseUrl}${path}`;
}

export function analyticsUrl(path: string): string {
  return `${config.analyticsBaseUrl}${path}`;
}

export const REFRESH_URL = apiUrl('/auth/refresh');

export function errorBody({ status, type, ...rest }: ErrorBodyOptions): ErrorResponse {
  return { status, type, title: 'Request failed', requestId: 'req-test', ...rest };
}

export function apiErrorOf(options: ErrorBodyOptions): ApiError {
  return new ApiError({ body: errorBody(options), retryAfterSeconds: undefined });
}

export function errorReply(options: ErrorBodyOptions) {
  return HttpResponse.json(errorBody(options), { status: options.status });
}

export function rateLimitedReply(headers: Record<string, string>) {
  return HttpResponse.json(
    errorBody({ status: 429, type: 'rate_limited', title: 'Too many requests' }),
    { status: 429, headers },
  );
}

export function recordSentRequests() {
  const sentFetch = vi.spyOn(globalThis, 'fetch');
  return () =>
    sentFetch.mock.calls.map(([url, init]) => ({
      url,
      method: init?.method,
      credentials: init?.credentials,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : init?.body,
    }));
}

export function refreshRoute({ token, onCall, hold }: RefreshRouteOptions) {
  let openCalls = 0;
  return http.post(REFRESH_URL, async () => {
    onCall?.();
    if (openCalls > 0) {
      return errorReply({ status: 401, type: 'unauthorized', title: 'Refresh token reused' });
    }
    openCalls += 1;
    if (hold !== undefined) {
      await delay(hold);
    }
    openCalls -= 1;
    const tokens: SessionTokens = { accessToken: token };
    return HttpResponse.json(tokens);
  });
}

export function expiringRoute({ url, freshToken, body }: ExpiringRouteOptions) {
  return http.get(url, ({ request }) => {
    if (request.headers.get('authorization') !== `Bearer ${freshToken}`) {
      return errorReply(TOKEN_EXPIRED);
    }
    return body === undefined ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(body);
  });
}

export function freshSuggestionsRoute() {
  return expiringRoute({
    url: apiUrl(SUGGESTIONS_REQUEST.path),
    freshToken: SESSION_TOKENS.fresh,
    body: SUGGESTIONS,
  });
}

export function suggestionsSession(refresh: Omit<RefreshRouteOptions, 'token'>) {
  return [refreshRoute({ token: SESSION_TOKENS.fresh, ...refresh }), freshSuggestionsRoute()];
}
