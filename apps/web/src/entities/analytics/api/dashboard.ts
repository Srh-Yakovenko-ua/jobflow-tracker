import {
  forecastResponseSchema,
  funnelResponseSchema,
  insightsResponseSchema,
  reasonsResponseSchema,
  sankeyResponseSchema,
  sourcesResponseSchema,
  timingsResponseSchema,
} from '@jobflow/shared';
import { type QueryKey, queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';

import { analyticsClient, withSearchParams } from '@/shared/api';

import { analyticsKeys } from '../model/keys';

type AnalyticsRoute<T> = Readonly<{
  path: string;
  schema: z.ZodType<T>;
  keyOf: (searchId?: string) => QueryKey;
}>;

type ScopedRequest<T> = Readonly<{ route: AnalyticsRoute<T>; searchId: string | undefined }>;

const ROUTES = {
  funnel: { path: '/analytics/funnel', schema: funnelResponseSchema, keyOf: analyticsKeys.funnel },
  sankey: { path: '/analytics/sankey', schema: sankeyResponseSchema, keyOf: analyticsKeys.sankey },
  reasons: {
    path: '/analytics/reasons',
    schema: reasonsResponseSchema,
    keyOf: analyticsKeys.reasons,
  },
  sources: {
    path: '/analytics/sources',
    schema: sourcesResponseSchema,
    keyOf: analyticsKeys.sources,
  },
  timings: {
    path: '/analytics/timings',
    schema: timingsResponseSchema,
    keyOf: analyticsKeys.timings,
  },
  forecast: {
    path: '/analytics/forecast',
    schema: forecastResponseSchema,
    keyOf: analyticsKeys.forecast,
  },
  insights: {
    path: '/analytics/insights',
    schema: insightsResponseSchema,
    keyOf: analyticsKeys.insights,
  },
} as const;

function scopedQueryOptions<T>({ route, searchId }: ScopedRequest<T>) {
  return queryOptions({
    queryKey: route.keyOf(searchId),
    queryFn: ({ signal }) =>
      analyticsClient.request({
        path: withSearchParams(route.path, { searchId }),
        schema: route.schema,
        signal,
      }),
  });
}

function searchBoundQueryOptions<T>(request: ScopedRequest<T>) {
  return { ...scopedQueryOptions(request), enabled: request.searchId !== undefined };
}

export const funnelQueryOptions = (searchId: string | undefined) =>
  searchBoundQueryOptions({ route: ROUTES.funnel, searchId });

export const sankeyQueryOptions = (searchId: string | undefined) =>
  searchBoundQueryOptions({ route: ROUTES.sankey, searchId });

export const reasonsQueryOptions = (searchId?: string) =>
  scopedQueryOptions({ route: ROUTES.reasons, searchId });

export const sourcesQueryOptions = (searchId?: string) =>
  scopedQueryOptions({ route: ROUTES.sources, searchId });

export const timingsQueryOptions = (searchId?: string) =>
  scopedQueryOptions({ route: ROUTES.timings, searchId });

export const forecastQueryOptions = (searchId?: string) =>
  scopedQueryOptions({ route: ROUTES.forecast, searchId });

export const insightsQueryOptions = (searchId?: string) =>
  scopedQueryOptions({ route: ROUTES.insights, searchId });
