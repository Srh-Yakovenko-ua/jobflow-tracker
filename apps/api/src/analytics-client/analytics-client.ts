import {
  type ForecastQuery,
  type ForecastResponse,
  forecastResponseSchema,
  type FunnelQuery,
  type FunnelResponse,
  funnelResponseSchema,
  type InsightsResponse,
  insightsResponseSchema,
  type ReasonsQuery,
  type ReasonsResponse,
  reasonsResponseSchema,
  type ResumeAbResponse,
  resumeAbResponseSchema,
  type SearchParams,
  type SourcesQuery,
  type SourcesResponse,
  sourcesResponseSchema,
  withSearchParams,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { fetchFailureOf, parsedBodyOf } from '../common/service-call-error.js';
import { withoutUndefined } from '../common/without-undefined.js';
import type { Env } from '../config/env.js';
import { JwtKeys, signServiceToken } from '../modules/auth/index.js';
import { ANALYTICS_ERRORS, AnalyticsServiceError } from './analytics-service-error.js';

export type UserAnalytics = {
  funnel: (query: FunnelQuery) => Promise<FunnelResponse>;
  forecast: (query: ForecastQuery) => Promise<ForecastResponse>;
  reasons: (query: ReasonsQuery) => Promise<ReasonsResponse>;
  sources: (query: SourcesQuery) => Promise<SourcesResponse>;
  resumeAb: () => Promise<ResumeAbResponse>;
  insights: (query: SourcesQuery) => Promise<InsightsResponse>;
};

type AnalyticsGet<Body> = { path: string; query?: SearchParams; schema: z.ZodType<Body> };

type AnalyticsCaller = { userId: string; requestId?: string | undefined };

@Injectable()
export class AnalyticsClient {
  private readonly baseUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly keys: JwtKeys,
  ) {
    this.baseUrl = config.get('ANALYTICS_URL', { infer: true });
  }

  forUser(userId: string, requestId?: string): UserAnalytics {
    const caller = { userId, requestId };
    const get = <Body>(call: AnalyticsGet<Body>) => this.get(call, caller);
    return {
      funnel: (query) => get({ path: '/analytics/funnel', query, schema: funnelResponseSchema }),
      forecast: (query) =>
        get({ path: '/analytics/forecast', query, schema: forecastResponseSchema }),
      reasons: (query) => get({ path: '/analytics/reasons', query, schema: reasonsResponseSchema }),
      sources: (query) => get({ path: '/analytics/sources', query, schema: sourcesResponseSchema }),
      resumeAb: () => get({ path: '/analytics/resume-ab', schema: resumeAbResponseSchema }),
      insights: (query) =>
        get({ path: '/analytics/insights', query, schema: insightsResponseSchema }),
    };
  }

  private async get<Body>(
    { path, query = {}, schema }: AnalyticsGet<Body>,
    { userId, requestId }: AnalyticsCaller,
  ): Promise<Body> {
    const token = await signServiceToken({
      keys: this.keys,
      scope: 'analytics:read',
      userId,
      issuedAt: new Date(),
    });
    const headers = withoutUndefined({
      authorization: `Bearer ${token}`,
      'x-request-id': requestId,
    });
    try {
      const response = await fetch(`${this.baseUrl}${withSearchParams(path, query)}`, {
        headers,
        signal: AbortSignal.timeout(DEPENDENCY_LIMITS.analyticsTimeoutMs),
      });
      return await parsedBodyOf(response, { schema, ErrorClass: AnalyticsServiceError });
    } catch (error) {
      throw fetchFailureOf(error, {
        timeoutType: ANALYTICS_ERRORS.timeout,
        ErrorClass: AnalyticsServiceError,
      });
    }
  }
}
