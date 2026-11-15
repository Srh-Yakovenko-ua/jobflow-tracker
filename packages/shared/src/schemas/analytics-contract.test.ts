import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type { paths } from '../generated/analytics-client.js';
import type { forecastResponseSchema } from './analytics-forecast.js';
import type { funnelResponseSchema } from './analytics-funnel.js';
import type { insightsResponseSchema } from './analytics-insights.js';
import type { matchValidationResponseSchema } from './analytics-match-validation.js';
import type { reasonsResponseSchema } from './analytics-reasons.js';
import type { resumeAbResponseSchema } from './analytics-resume-ab.js';
import type { sankeyResponseSchema } from './analytics-sankey.js';
import type { sourcesResponseSchema } from './analytics-sources.js';
import type { normsResponseSchema, timingsResponseSchema } from './analytics-timings.js';
import type { rejectionReasonsSummarySchema } from './rejection-reasons-summary.js';

type AnalyticsResponse<P extends keyof paths> =
  paths[P]['get']['responses'][200]['content']['application/json'];

type WebSchemas = {
  '/analytics/funnel': typeof funnelResponseSchema;
  '/analytics/sankey': typeof sankeyResponseSchema;
  '/analytics/reasons': typeof reasonsResponseSchema;
  '/analytics/reasons/summary': typeof rejectionReasonsSummarySchema;
  '/analytics/sources': typeof sourcesResponseSchema;
  '/analytics/timings': typeof timingsResponseSchema;
  '/analytics/norms': typeof normsResponseSchema;
  '/analytics/resume-ab': typeof resumeAbResponseSchema;
  '/analytics/forecast': typeof forecastResponseSchema;
  '/analytics/match-validation': typeof matchValidationResponseSchema;
  '/analytics/insights': typeof insightsResponseSchema;
};

type Drift = {
  [P in keyof WebSchemas]: z.infer<WebSchemas[P]> extends AnalyticsResponse<P> ? never : P;
}[keyof WebSchemas];

describe('analytics response contract', () => {
  it('keeps every web analytics schema assignable to the analytics OpenAPI response', () => {
    expectTypeOf<Drift>().toBeNever();
  });

  it('maps every analytics route except health to a web schema', () => {
    expectTypeOf<keyof WebSchemas>().toEqualTypeOf<
      Exclude<keyof paths, '/health' | '/health/ready'>
    >();
  });
});
