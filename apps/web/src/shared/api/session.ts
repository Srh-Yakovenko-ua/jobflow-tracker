import { sessionTokensSchema } from '@jobflow/shared';

import { config } from '@/shared/config';

import { ApiError } from './api-error';
import { parseResponse } from './parse-response';
import { send } from './transport';

const REFRESH_REQUEST = { method: 'POST', path: '/auth/refresh' } as const;
const REFRESH_LOCK = 'jobflow:auth-refresh';

let accessToken: string | undefined;
let refreshInFlight: Promise<string> | undefined;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = undefined;
}

export function getAccessToken(): string | undefined {
  return accessToken;
}

async function requestFreshToken(): Promise<string> {
  try {
    const body = await send({
      url: `${config.apiBaseUrl}${REFRESH_REQUEST.path}`,
      init: {
        method: REFRESH_REQUEST.method,
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    });
    const tokens = parseResponse({ schema: sessionTokensSchema, body, request: REFRESH_REQUEST });
    accessToken = tokens.accessToken;
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      accessToken = undefined;
    }
    throw error;
  }
}

export function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= navigator.locks.request(REFRESH_LOCK, requestFreshToken).finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

export function refreshAfter(staleToken: string | undefined): Promise<string> {
  if (accessToken !== undefined && accessToken !== staleToken) {
    return Promise.resolve(accessToken);
  }
  return refreshAccessToken();
}
