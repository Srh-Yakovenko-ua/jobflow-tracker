import type { RefreshTokenBody, SessionTokens } from '@jobflow/shared';
import type { Request, Response } from 'express';

import { httpOnlyCookie } from './http-only-cookie.js';
import { REFRESH_TOKEN_TTL_MS } from './refresh-tokens.js';
import type { IssuedSession } from './session.service.js';

export const REFRESH_COOKIE = 'refresh_token';

export const CLIENT_HEADER = 'x-client';

export const MOBILE_CLIENT = 'mobile';

const refreshCookie = httpOnlyCookie({
  name: REFRESH_COOKIE,
  sameSite: 'strict',
  path: '/auth',
  maxAgeMs: REFRESH_TOKEN_TTL_MS,
});

export type HttpExchange = { req: Request; res: Response };

export type RefreshClient = { mobile: boolean; refreshCookie: string | undefined };

export type SessionReply = { client: RefreshClient; res: Response; session: IssuedSession };

export function sessionClientOf(req: Request): RefreshClient {
  return {
    mobile: req.get(CLIENT_HEADER) === MOBILE_CLIENT,
    refreshCookie: refreshCookie.read(req),
  };
}

export function readRefreshToken(
  client: RefreshClient,
  body?: RefreshTokenBody,
): string | undefined {
  return client.mobile ? body?.refreshToken : client.refreshCookie;
}

export function sendSession({ client, res, session }: SessionReply): SessionTokens {
  res.set('Cache-Control', 'no-store');
  if (client.mobile) {
    return session;
  }
  refreshCookie.set(res, session.refreshToken);
  return { accessToken: session.accessToken };
}

export function clearRefreshCookie(res: Response): void {
  refreshCookie.clear(res);
}
