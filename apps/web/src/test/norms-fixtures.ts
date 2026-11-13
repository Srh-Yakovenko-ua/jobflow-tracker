import type { NormsResponse } from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { analyticsUrl } from './api-handlers';

export const NORMS_URL = analyticsUrl('/analytics/norms');

export const UNKNOWN_NORMS: NormsResponse = {
  stageNormDays: { applied: null, screening: null, tech_interview: null, final: null },
  medianDaysToOffer: null,
};

export const DESIGN_NORMS: NormsResponse = {
  stageNormDays: { applied: 4, screening: 7, tech_interview: 9, final: 17 },
  medianDaysToOffer: 37,
};

export function normsRoute(norms: NormsResponse | HttpResponseResolver = UNKNOWN_NORMS) {
  const reply = typeof norms === 'function' ? norms : () => HttpResponse.json(norms);
  return http.get(NORMS_URL, reply);
}
