import {
  DEFAULT_SEARCH_TITLE,
  type FunnelResponse,
  type SearchListResponse,
  type SearchSummary,
} from '@jobflow/shared';
import {
  buildDesignFunnel,
  buildDesignReasons,
  buildDesignSankey,
  buildDesignSources,
  buildDesignTimings,
  buildFoldedSankey,
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

export const DESIGN_FUNNEL_ROWS = [
  {
    stage: 'відгук 54',
    conversion: 'конверсія відгук → скринінг: 43% (29–58%)',
    exits: ['відкликав 2', 'ghosted 14', 'відмова 21'],
  },
  {
    stage: 'скринінг 17',
    conversion: "конверсія скринінг → техінтерв'ю: 60% (36–80%)",
    exits: ['відкликав 1', 'ghosted 2', 'відмова 5'],
  },
  {
    stage: "техінтерв'ю 9",
    conversion: "конверсія техінтерв'ю → фінал: 50% (22–78%)",
    exits: ['ghosted 1', 'відмова 4'],
  },
  {
    stage: 'фінал 4',
    conversion: 'Ще 1 відгук до першого висновку',
    exits: ['відкликав 1', 'відмова 2'],
  },
  { stage: 'офер 1', conversion: null, exits: [] },
];

export const DESIGN_ENDINGS = ['офер 1', 'відкликав 4', 'ghosted 17', 'відмова 32'];

const SEARCHES: SearchListResponse = { items: [ACTIVE_SEARCH, ARCHIVED_SEARCH] };

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

const sankeyReply: HttpResponseResolver = ({ request }) =>
  HttpResponse.json(
    new URL(request.url).searchParams.get('split') === 'reason'
      ? buildFoldedSankey()
      : buildDesignSankey(),
  );

function designBodies(): Record<DashboardRoute, JsonBodyType | HttpResponseResolver> {
  return {
    searches: SEARCHES,
    funnel: buildDesignFunnel(),
    sankey: sankeyReply,
    reasons: buildDesignReasons(),
    sources: buildDesignSources(),
    timings: buildDesignTimings(),
    forecast: buildForecast(),
    insights: designInsightsBody(),
    'resume-ab': DESIGN_RESUME_AB,
  };
}

type RouteBody = JsonBodyType | HttpResponseResolver;

type RouteReply = Readonly<{ url: string; override: RouteBody | undefined; design: RouteBody }>;

function isResolver(body: RouteBody): body is HttpResponseResolver {
  return typeof body === 'function';
}

function resolverOf(body: RouteBody): HttpResponseResolver {
  return isResolver(body) ? body : () => HttpResponse.json(body);
}

function repliesOf({ url, override, design }: RouteReply) {
  const bodies = override === undefined ? [design] : [override, design];
  return bodies.map((body) => http.get(url, resolverOf(body)));
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
