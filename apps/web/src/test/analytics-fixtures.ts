import {
  DEFAULT_SEARCH_TITLE,
  type FunnelResponse,
  type ReasonsResponse,
  type SankeyResponse,
  type SearchListResponse,
  type SearchSummary,
  type SourcesResponse,
} from '@jobflow/shared';
import {
  buildDesignFunnel,
  buildDesignTimings,
  buildForecast,
  designInsightsBody,
} from '@jobflow/shared/testing';
import type { HttpResponseResolver, JsonBodyType } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { analyticsUrl, apiUrl } from './api-handlers';
import { DESIGN_RESUME_AB, RESUME_AB_URL } from './resume-ab-fixtures';

export const DASHBOARD_ROUTES = [
  'searches',
  'funnel',
  'sankey',
  'reasons',
  'sources',
  'timings',
  'forecast',
  'insights',
  'resume-ab',
] as const;

export type DashboardRoute = (typeof DASHBOARD_ROUTES)[number];

export type SentRequest = Readonly<{ route: DashboardRoute; url: URL }>;

export type DashboardRoutesOptions = Partial<
  Record<DashboardRoute, JsonBodyType | HttpResponseResolver>
>;

const SEARCH_DEFAULTS: Omit<SearchSummary, 'id' | 'title' | 'status'> = {
  outcome: null,
  startedAt: '2026-08-20T09:00:00.000Z',
  finishedAt: null,
  days: 84,
  applications: 54,
  interviews: 9,
  offers: 1,
  daysToOffer: null,
};

export const ACTIVE_SEARCH: SearchSummary = {
  ...SEARCH_DEFAULTS,
  id: '0b6f3c1e-5d2a-4c8e-9f10-0000000005a1',
  title: DEFAULT_SEARCH_TITLE,
  status: 'active',
};

export const ARCHIVED_SEARCH: SearchSummary = {
  ...SEARCH_DEFAULTS,
  id: '0b6f3c1e-5d2a-4c8e-9f10-0000000005a2',
  title: 'Пошук 2025',
  status: 'archived',
  outcome: 'offer_accepted',
  startedAt: '2025-09-22T09:00:00.000Z',
  finishedAt: '2025-12-01T09:00:00.000Z',
  days: 70,
  applications: 31,
};

const SEARCHES: SearchListResponse = { items: [ACTIVE_SEARCH, ARCHIVED_SEARCH] };

const EMPTY_GRAPH = { nodes: [], links: [] };

const SANKEY: SankeyResponse = { split: null, detailed: EMPTY_GRAPH, merged: EMPTY_GRAPH };

const REASONS: ReasonsResponse = { stages: [], headline: null };

const SOURCES: SourcesResponse = { sources: [], silentGhosts: { total: 0, easyApply: 0 } };

export function lowDataFunnel(): FunnelResponse {
  const funnel = buildDesignFunnel();
  const sent = { total: 4, thisMonth: 4, previousMonth: 0 };
  return { ...funnel, kpis: { ...funnel.kpis, sent, daysInSearch: 3 } };
}

const URLS: Record<DashboardRoute, string> = {
  searches: apiUrl('/searches'),
  funnel: analyticsUrl('/analytics/funnel'),
  sankey: analyticsUrl('/analytics/sankey'),
  reasons: analyticsUrl('/analytics/reasons'),
  sources: analyticsUrl('/analytics/sources'),
  timings: analyticsUrl('/analytics/timings'),
  forecast: analyticsUrl('/analytics/forecast'),
  insights: analyticsUrl('/analytics/insights'),
  'resume-ab': RESUME_AB_URL,
};

function designBodies(): Record<DashboardRoute, JsonBodyType> {
  return {
    searches: SEARCHES,
    funnel: buildDesignFunnel(),
    sankey: SANKEY,
    reasons: REASONS,
    sources: SOURCES,
    timings: buildDesignTimings(),
    forecast: buildForecast(),
    insights: designInsightsBody(),
    'resume-ab': DESIGN_RESUME_AB,
  };
}

type RouteReply = Readonly<{
  url: string;
  override: JsonBodyType | HttpResponseResolver | undefined;
  design: JsonBodyType;
}>;

function isResolver(override: RouteReply['override']): override is HttpResponseResolver {
  return typeof override === 'function';
}

function repliesOf({ url, override, design }: RouteReply) {
  if (!isResolver(override)) return [http.get(url, () => HttpResponse.json(override ?? design))];
  return [http.get(url, override), http.get(url, () => HttpResponse.json(design))];
}

export function dashboardRoutes(options: DashboardRoutesOptions = {}) {
  const sent: SentRequest[] = [];
  const design = designBodies();
  const handlers = DASHBOARD_ROUTES.flatMap((route) => [
    http.get(URLS[route], ({ request }) => {
      sent.push({ route, url: new URL(request.url) });
    }),
    ...repliesOf({ url: URLS[route], override: options[route], design: design[route] }),
  ]);
  return { handlers, sent };
}
