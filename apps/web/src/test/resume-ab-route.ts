import type { ResumeAbResponse } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { analyticsUrl } from './api-handlers';

export const RESUME_AB_URL = analyticsUrl('/analytics/resume-ab');

export const EMPTY_RESUME_AB: ResumeAbResponse = { versions: [], comparison: null };

export function resumeAbRoute(body: ResumeAbResponse | HttpResponseResolver = EMPTY_RESUME_AB) {
  const reply = typeof body === 'function' ? body : () => HttpResponse.json(body);
  return http.get(RESUME_AB_URL, reply);
}
