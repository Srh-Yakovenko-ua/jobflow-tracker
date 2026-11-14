import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy } from '@/shared/config';
import { AUTH_ROUTES, isAuthPage, loginHref, safeReturnTo } from '@/shared/lib/return-to';
import { SESSION_COOKIE } from '@/shared/lib/session-cookie';

const CSP_HEADER = 'Content-Security-Policy';

const PUBLIC_PREFIXES = ['/design-system', '/dev/'] as const;

function redirectTo(path: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

function passThrough(request: NextRequest): NextResponse {
  const policy = contentSecurityPolicy(Buffer.from(crypto.randomUUID()).toString('base64'));
  const headers = new Headers(request.headers);
  headers.set(CSP_HEADER, policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search, searchParams } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);
  if (isAuthPage(pathname)) {
    return signedIn
      ? redirectTo(safeReturnTo(searchParams.get(AUTH_ROUTES.returnParam)), request)
      : passThrough(request);
  }
  return signedIn || isPublicPage(pathname)
    ? passThrough(request)
    : redirectTo(loginHref(`${pathname}${search}`), request);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
};
