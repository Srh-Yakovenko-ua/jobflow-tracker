import { clearCookie, hasCookie, writeCookie } from './cookie';

export const SESSION_COOKIE = 'jobflow_session';

export function writeSessionCookie(): void {
  writeCookie({ name: SESSION_COOKIE, value: '1' });
}

export function clearSessionCookie(): void {
  clearCookie(SESSION_COOKIE);
}

export function hasSessionCookie(): boolean {
  return hasCookie(SESSION_COOKIE);
}
