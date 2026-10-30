import type { AuthResponse, MeResponse } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, type ErrorBodyOptions, errorReply, SESSION_TOKENS } from './api-handlers';

export type AuthRouteOptions = {
  path: '/auth/login' | '/auth/register';
  reply?: HttpResponseResolver;
};

export type AuthErrorRouteOptions = Pick<AuthRouteOptions, 'path'> & {
  error: ErrorBodyOptions;
};

export const ME_RESPONSE: MeResponse = {
  user: {
    id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000aa',
    email: 'andrii@example.com',
    displayName: 'Андрій Ковальчук',
    locale: 'uk',
  },
  settings: {
    silenceDays: 12,
    autoGhostDays: null,
    askRejectionReason: true,
    monthlySummaryEnabled: false,
    theme: 'light',
    timezone: 'Europe/Kyiv',
    quietHoursStart: '21:30',
    quietHoursEnd: '06:45',
    notifyInApp: false,
    notifyPush: true,
    notifyEmail: false,
    analyticsOptOut: false,
    activeResumeVersionId: null,
  },
};

export const AUTH_RESPONSE: AuthResponse = {
  user: ME_RESPONSE.user,
  accessToken: SESSION_TOKENS.fresh,
};

export function meRoute() {
  return http.get(apiUrl('/auth/me'), () => HttpResponse.json(ME_RESPONSE));
}

export function authRoute({
  path,
  reply = () => HttpResponse.json(AUTH_RESPONSE),
}: AuthRouteOptions) {
  return http.post(apiUrl(path), reply);
}

export function authErrorRoute({ path, error }: AuthErrorRouteOptions) {
  return authRoute({ path, reply: () => errorReply(error) });
}
