import type { RefreshTokenBody, SessionTokens } from '@jobflow/shared';
import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';

import { API_PREFIX } from '../../common/api-prefix.middleware.js';
import { REFRESH_TOKEN_TTL_MS } from './refresh-tokens.js';
import type { IssuedSession } from './session.service.js';

export const REFRESH_COOKIE = 'refresh_token';

export const CLIENT_HEADER = 'x-client';

export const MOBILE_CLIENT = 'mobile';

const COOKIE_SCOPE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: `/${API_PREFIX}/auth`,
};

export type HttpExchange = { req: Request; res: Response };

export type SessionReply = HttpExchange & { session: IssuedSession };

function isMobile(req: Request): boolean {
  return req.get(CLIENT_HEADER) === MOBILE_CLIENT;
}

export function readRefreshToken(req: Request, body?: RefreshTokenBody): string | undefined {
  return isMobile(req) ? body?.refreshToken : parseCookie(req.headers.cookie ?? '')[REFRESH_COOKIE];
}

export function sendSession({ req, res, session }: SessionReply): SessionTokens {
  res.set('Cache-Control', 'no-store');
  if (isMobile(req)) {
    return session;
  }
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...COOKIE_SCOPE,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
  return { accessToken: session.accessToken };
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, COOKIE_SCOPE);
}
