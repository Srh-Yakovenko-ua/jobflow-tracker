import { type NextRequest, NextResponse } from 'next/server';

import { AUTH_ROUTES, isAuthPage, loginHref, safeReturnTo } from '@/shared/lib/return-to';
import { SESSION_COOKIE } from '@/shared/lib/session-cookie';

function redirectTo(path: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search, searchParams } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);
  if (isAuthPage(pathname)) {
    return signedIn
      ? redirectTo(safeReturnTo(searchParams.get(AUTH_ROUTES.returnParam)), request)
      : NextResponse.next();
  }
  return signedIn ? NextResponse.next() : redirectTo(loginHref(`${pathname}${search}`), request);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|icon.svg|design-system|dev/).*)',
};
