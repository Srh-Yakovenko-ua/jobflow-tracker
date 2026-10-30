import type { MeResponse } from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';

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

export function meRoute() {
  return http.get(apiUrl('/auth/me'), () => HttpResponse.json(ME_RESPONSE));
}
