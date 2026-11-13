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

import { analyticsClient, type SearchParams, withSearchParams } from '@/shared/api';

import { analyticsKeys, type SankeyScope } from '../model/keys';

type AnalyticsPath<T> = Readonly<{ path: string; schema: z.ZodType<T> }>;

type AnalyticsRoute<T> = AnalyticsPath<T> & Readonly<{ keyOf: (searchId?: string) => QueryKey }>;

type ScopedRequest<T> = Readonly<{ route: AnalyticsRoute<T>; searchId: string | undefined }>;

type PathRequest<T> = Readonly<{
  route: AnalyticsPath<T>;
  queryKey: QueryKey;
  params: SearchParams;
}>;

const SANKEY_ROUTE = { path: '/analytics/sankey', schema: sankeyResponseSchema };

const ROUTES = {
  funnel: { path: '/analytics/funnel', schema: funnelResponseSchema, keyOf: analyticsKeys.funnel },
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

function pathQueryOptions<T>({ route, queryKey, params }: PathRequest<T>) {
  return queryOptions({
    queryKey,
    queryFn: ({ signal }) =>
      analyticsClient.request({
        path: withSearchParams(route.path, params),
        schema: route.schema,
        signal,
      }),
  });
}

function scopedQueryOptions<T>({ route, searchId }: ScopedRequest<T>) {
  return pathQueryOptions({ route, queryKey: route.keyOf(searchId), params: { searchId } });
}

export const funnelQueryOptions = (searchId: string | undefined) => ({
  ...scopedQueryOptions({ route: ROUTES.funnel, searchId }),
  enabled: searchId !== undefined,
});

export const sankeyQueryOptions = (scope: SankeyScope) => ({
  ...pathQueryOptions({
    route: SANKEY_ROUTE,
    queryKey: analyticsKeys.sankey(scope),
    params: scope,
  }),
  enabled: scope.searchId !== undefined,
});

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
