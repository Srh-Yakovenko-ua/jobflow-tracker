import { sessionTokensSchema } from '@jobflow/shared';

import { config } from '@/shared/config';
import { clearSessionCookie, writeSessionCookie } from '@/shared/lib/session-cookie';

import { ApiError } from './api-error';
import { parseResponse } from './parse-response';
import { send } from './transport';

const REFRESH_REQUEST = { method: 'POST', path: '/auth/refresh' } as const;
const REFRESH_LOCK = 'jobflow:auth-refresh';

type SessionEndListener = () => void;

const sessionEndListeners = new Set<SessionEndListener>();

let accessToken: string | undefined;
let refreshInFlight: Promise<string> | undefined;

export function setAccessToken(token: string): void {
  accessToken = token;
  writeSessionCookie();
}

export function clearAccessToken(): void {
  accessToken = undefined;
  clearSessionCookie();
}

export function getAccessToken(): string | undefined {
  return accessToken;
}

export function onSessionEnd(listener: SessionEndListener): () => void {
  sessionEndListeners.add(listener);
  return () => {
    sessionEndListeners.delete(listener);
  };
}

function endSession(): void {
  clearAccessToken();
  for (const listener of sessionEndListeners) {
    listener();
  }
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
    setAccessToken(tokens.accessToken);
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      endSession();
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

export function ensureAccessToken(): Promise<string> {
  return refreshAfter(undefined);
}
