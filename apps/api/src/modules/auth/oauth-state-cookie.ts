import { httpOnlyCookie } from './http-only-cookie.js';
import { OAUTH_STATE_TTL_SECONDS } from './oauth-state.js';

export const OAUTH_STATE_COOKIE = 'oauth_state';

export const oauthStateCookie = httpOnlyCookie({
  name: OAUTH_STATE_COOKIE,
  sameSite: 'lax',
  path: '/auth/oauth',
  maxAgeMs: OAUTH_STATE_TTL_SECONDS * 1000,
});
