export const AUTH_ROUTES = {
  login: '/login',
  register: '/register',
  home: '/board',
  returnParam: 'next',
} as const;

const PROBE_ORIGIN = 'http://jobflow.invalid';

const LOGIN_HREF_MAX_LENGTH = 4_096;

const VACANCY_TEXT_PARAM = 'text';

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

function addressOf(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeReturnTo(value: unknown): string {
  const url = sameOriginUrl(value);
  if (url === null || isAuthPage(url.pathname)) {
    return AUTH_ROUTES.home;
  }
  return addressOf(url);
}

function loginHrefFor(returnTo: string): string {
  const query = new URLSearchParams({ [AUTH_ROUTES.returnParam]: returnTo });
  return `${AUTH_ROUTES.login}?${query.toString()}`;
}

function fitsRequestHeader(href: string): boolean {
  return href.length <= LOGIN_HREF_MAX_LENGTH;
}

function withoutVacancyText(returnTo: string): string {
  const url = sameOriginUrl(returnTo);
  if (url === null) {
    return returnTo;
  }
  url.searchParams.delete(VACANCY_TEXT_PARAM);
  return addressOf(url);
}

export function loginHref(returnTo: string): string {
  const whole = loginHrefFor(returnTo);
  if (fitsRequestHeader(whole)) {
    return whole;
  }
  const textless = loginHrefFor(withoutVacancyText(returnTo));
  return fitsRequestHeader(textless) ? textless : loginHrefFor(returnTo.replace(/\?.*$/s, ''));
}
