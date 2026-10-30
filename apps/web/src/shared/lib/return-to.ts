export const AUTH_ROUTES = {
  login: '/login',
  register: '/register',
  home: '/board',
  returnParam: 'next',
} as const;

const PROBE_ORIGIN = 'http://jobflow.invalid';

const AUTH_PAGES: ReadonlySet<string> = new Set([AUTH_ROUTES.login, AUTH_ROUTES.register]);

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

function sameOriginUrl(value: unknown): URL | null {
  if (typeof value !== 'string') {
    return null;
  }
  const url = URL.parse(value, PROBE_ORIGIN);
  return url?.origin === PROBE_ORIGIN && !url.pathname.startsWith('//') ? url : null;
}

export function safeReturnTo(value: unknown): string {
  const url = sameOriginUrl(value);
  if (url === null || isAuthPage(url.pathname)) {
    return AUTH_ROUTES.home;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginHref(returnTo: string): string {
  const query = new URLSearchParams({ [AUTH_ROUTES.returnParam]: returnTo });
  return `${AUTH_ROUTES.login}?${query.toString()}`;
}
