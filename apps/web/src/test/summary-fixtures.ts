import type {
  CaptureRetryResponse,
  Plan,
  Summary,
  SummaryArchive,
  SummaryArchiveItem,
  SummaryResponse,
} from '@jobflow/shared';
import { buildPlan, buildSummary } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, idempotencyKeyOf } from './api-handlers';
import { fixtureIdOf } from './board-fixtures';

export type SummaryRoutesOptions = Readonly<{
  latest?: SummaryResponse;
  archive?: SummaryArchive;
  latestReply?: HttpResponseResolver;
  requestReply?: HttpResponseResolver;
  planReply?: HttpResponseResolver;
}>;

export type SentSummaryPlan = Readonly<{ aiJobId: string; idempotencyKey: string | null }>;

export const DESIGN_SUMMARY = buildSummary();

export const SUMMARY_PLAN: Plan = buildPlan();

export const REGENERATED_JOB_ID = fixtureIdOf(451);

export const NO_SUMMARY: SummaryResponse = { summary: null, job: null };

export function latestOf(summary: Summary): SummaryResponse {
  return { summary, job: { id: summary.aiJobId, status: 'done' } };
}

export const READY_SUMMARY = latestOf(DESIGN_SUMMARY);

function archiveItem(summary: Summary, plan: SummaryArchiveItem['plan']): SummaryArchiveItem {
  return { ...summary, plan };
}

export const DESIGN_ARCHIVE: SummaryArchive = {
  items: [
    archiveItem(DESIGN_SUMMARY, null),
    archiveItem(
      buildSummary({
        aiJobId: fixtureIdOf(452),
        month: '2026-07',
        generatedAt: '2026-08-01T04:00:09.000Z',
        planId: fixtureIdOf(453),
      }),
      { items: 4, done: 3 },
    ),
    archiveItem(
      buildSummary({
        aiJobId: fixtureIdOf(454),
        month: '2026-06',
        generatedAt: '2026-07-01T04:00:07.000Z',
      }),
      null,
    ),
  ],
};

function accepted(): Response {
  return HttpResponse.json<CaptureRetryResponse>({ jobId: REGENERATED_JOB_ID }, { status: 202 });
}

export function summaryRoutes({
  latest = NO_SUMMARY,
  archive = DESIGN_ARCHIVE,
  latestReply,
  requestReply,
  planReply,
}: SummaryRoutesOptions = {}) {
  const store = { latest };
  const sent = {
    latestReads: 0,
    requests: [] as (string | null)[],
    plans: [] as SentSummaryPlan[],
  };
  const handlers = [
    http.get(apiUrl('/summaries/latest'), (info) => {
      sent.latestReads += 1;
      return latestReply === undefined ? HttpResponse.json(store.latest) : latestReply(info);
    }),
    http.get(apiUrl('/summaries'), () => HttpResponse.json(archive)),
    http.post(apiUrl('/summaries'), (info) => {
      sent.requests.push(idempotencyKeyOf(info.request.headers));
      if (requestReply !== undefined) return requestReply(info);
      store.latest = { ...store.latest, job: { id: REGENERATED_JOB_ID, status: 'queued' } };
      return accepted();
    }),
    http.post<{ aiJobId: string }>(apiUrl('/summaries/:aiJobId/plan'), (info) => {
      const { aiJobId } = info.params;
      sent.plans.push({ aiJobId, idempotencyKey: idempotencyKeyOf(info.request.headers) });
      if (planReply !== undefined) return planReply(info);
      const { summary } = store.latest;
      store.latest = {
        ...store.latest,
        summary: summary && { ...summary, planId: SUMMARY_PLAN.id },
      };
      return HttpResponse.json(SUMMARY_PLAN, { status: 201 });
    }),
  ];
  return { handlers, sent };
}
