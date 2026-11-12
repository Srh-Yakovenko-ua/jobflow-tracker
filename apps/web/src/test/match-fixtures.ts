import {
  type ApplicationMatchResponse,
  applicationMatchResponseSchema,
  type ApplicationResponse,
  type ResumeVersion,
} from '@jobflow/shared';
import { buildJobStatus } from '@jobflow/shared/testing';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf } from './board-fixtures';
import { jobRoute } from './job-fixtures';
import { buildResumeVersion } from './resume-fixtures';

type ScoredMatch = Readonly<{ version: ResumeVersion; score: number; computedAt: string }>;

export const MATCH_JOB_ID = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1b01';

export const MATCH_NOW = new Date('2026-11-15T09:00:00.000Z');

export const DESIGN_VERSION = buildResumeVersion({
  id: fixtureIdOf(502),
  number: 2,
  title: 'акцент на продукті',
});

export const NEXT_VERSION = buildResumeVersion({
  id: fixtureIdOf(503),
  number: 3,
  title: 'для дизайн-ролей',
  uploadedAt: '2026-09-01T09:00:00.000Z',
  applicationsCount: 3,
});

export const ARCHIVED_VERSION = buildResumeVersion({
  id: fixtureIdOf(501),
  number: 1,
  title: 'хронологічне',
  isArchived: true,
});

export const DESIGN_VERSIONS: readonly ResumeVersion[] = [
  NEXT_VERSION,
  DESIGN_VERSION,
  ARCHIVED_VERSION,
];

export const MATCHED_APPLICATION: ApplicationResponse = {
  ...ACME_APPLICATION,
  resumeVersionId: DESIGN_VERSION.id,
  matchScore: 78,
};

export const DESIGN_EXPLANATION =
  'AWS згадується в описі один раз і без «must have» — на скринінгу це не питали. Score рахується по CV v2; при перепривязці до іншої версії він перерахується.';

export const NO_MATCH: ApplicationMatchResponse = { match: null, job: null };

export const DESIGN_MATCH = applicationMatchResponseSchema.parse({
  match: {
    score: 78,
    matched: [
      { name: 'React + TypeScript, 6 років', weight: 'must', coverage: 'full', pointsLost: 0 },
      { name: 'Node.js у проді', weight: 'must', coverage: 'full', pointsLost: 0 },
      { name: 'GraphQL', weight: 'nice', coverage: 'partial', pointsLost: 0 },
      { name: 'Рівень англійської Upper-Int', weight: 'must', coverage: 'full', pointsLost: 0 },
    ],
    missing: [
      { name: 'AWS / інфраструктура', weight: 'must', pointsLost: 14 },
      { name: 'Досвід ліда команди 3+', weight: 'nice', pointsLost: 8 },
    ],
    ignored: [{ name: 'Домен fintech', coverage: 'missing' }],
    explanation: DESIGN_EXPLANATION,
    resumeVersion: { id: DESIGN_VERSION.id, number: 2, title: DESIGN_VERSION.title },
    computedAt: '2026-08-14T09:00:00.000Z',
  },
  job: null,
});

export function scoredMatch({ version, score, computedAt }: ScoredMatch): ApplicationMatchResponse {
  if (DESIGN_MATCH.match === null) throw new Error('the design match has a breakdown');
  const { id, number, title } = version;
  return {
    match: { ...DESIGN_MATCH.match, score, computedAt, resumeVersion: { id, number, title } },
    job: { id: MATCH_JOB_ID, status: 'done' },
  };
}

export function matchJob(status: NonNullable<ApplicationMatchResponse['job']>['status']) {
  return { match: null, job: { id: MATCH_JOB_ID, status } } satisfies ApplicationMatchResponse;
}

export function queuedMatchJobRoute() {
  return jobRoute({
    job: () =>
      buildJobStatus({ status: 'queued', queue: { ahead: 1, etaSeconds: 30 }, kind: 'match' }),
  }).handler;
}

export function matchRoute(initial: ApplicationMatchResponse = NO_MATCH) {
  const state = { response: initial };
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/applications/:id/match'), ({ params }) => {
    sent.push(params.id);
    return HttpResponse.json(state.response);
  });
  return {
    handler,
    sent,
    answer: (next: ApplicationMatchResponse) => {
      state.response = next;
    },
  };
}
