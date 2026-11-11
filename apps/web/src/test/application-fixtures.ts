import {
  type ApplicationResponse,
  applicationResponseSchema,
  type CaptureRetryResponse,
  DRAFT_PLACEHOLDERS,
  moveApplicationInputSchema,
  updateApplicationInputSchema,
} from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import {
  applicationResponseOf,
  type BoardRouteOptions,
  heldReply,
  type MoveRouteOptions,
} from './board-fixtures';

export type ApplicationRouteOptions = MoveRouteOptions & {
  application: ApplicationResponse;
  moves?: readonly unknown[];
};

export type UpdateRouteOptions = MoveRouteOptions & { application: ApplicationResponse };

export type BoardCardRouteOptions = BoardRouteOptions & { cardRead?: HttpResponseResolver };

export type RetryRouteOptions = MoveRouteOptions & { jobId: CaptureRetryResponse['jobId'] };

type CardActionRoute = MoveRouteOptions & {
  method: 'delete' | 'post';
  path: string;
  fallback?: () => Response;
};

export function checkFieldOf<Value>(value: Value, evidence: string) {
  return { ...vacancyFieldOf(value, evidence), confidence: 'check' as const };
}

export const SALARY_IN_TEXT = 'from 4700\nto  5900 net';

export const REVIEW_DRAFT = applicationResponseOf({
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000301',
  company: 'Acme',
  position: 'Senior React developer',
  source: 'other',
  salaryMin: 4700,
  salaryMax: 5900,
  currency: 'USD',
  stack: ['React'],
  workMode: 'remote',
  isDraft: true,
  matchScore: null,
  rawText: `Acme hires a Senior React developer\nMode: remote, stack: React.\nSalary: ${SALARY_IN_TEXT}`,
  aiParsed: buildVacancyParseOutput({
    salaryMin: checkFieldOf(4700, 'from 4700 to 5900 net'),
    salaryMax: checkFieldOf(5900, 'from 4700 to 5900 net'),
    currency: vacancyFieldOf('USD', null),
  }),
});

export const FAILED_DRAFT = applicationResponseOf({
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000302',
  ...DRAFT_PLACEHOLDERS,
  source: 'other',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  stack: [],
  isDraft: true,
  matchScore: null,
  rawText: '5+ years of experience, design patterns, Upper-Intermediate English',
});

export const ACME_APPLICATION = applicationResponseOf({
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000201',
  company: 'Acme Technologies',
  position: 'Senior React Developer',
  currentStage: 'tech_interview',
  daysInStage: 9,
  salaryMin: 4500,
  salaryMax: 6000,
  currency: 'USD',
  location: 'Kyiv',
  workMode: 'hybrid',
  stack: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Vitest'],
  url: 'https://jobs.example.com/acme/senior-react',
  createdAt: '2026-10-12T09:00:00Z',
});

export function applicationRoute({ application, moves = [], ...control }: ApplicationRouteOptions) {
  const sent: string[] = [];
  const moved = () => {
    const last = moves.at(-1);
    const currentStage =
      last === undefined
        ? application.currentStage
        : moveApplicationInputSchema.parse(last).toStage;
    return HttpResponse.json({ ...application, currentStage });
  };
  const handler = http.get(apiUrl(`/applications/${application.id}`), (info) => {
    sent.push(application.id);
    return heldReply({ ...control, info, fallback: moved });
  });
  return { handler, sent };
}

export function boardCardRoutes({
  cards = [],
  liveCard = (card) => card,
  cardRead,
}: BoardCardRouteOptions) {
  return cards.map((card) =>
    http.get(apiUrl(`/applications/${card.id}`), (info) =>
      cardRead === undefined
        ? HttpResponse.json(applicationResponseOf(liveCard(card)))
        : cardRead(info),
    ),
  );
}

export function updateRoute({ application, ...control }: UpdateRouteOptions) {
  const sent: unknown[] = [];
  const handler = http.patch(apiUrl(`/applications/${application.id}`), async (info) => {
    const body: unknown = await info.request.json();
    sent.push(body);
    const updated = () =>
      applicationResponseSchema.parse({
        ...application,
        ...updateApplicationInputSchema.parse(body),
      });
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(updated()) });
  });
  return { handler, sent };
}

function noContent(): Response {
  return new HttpResponse(null, { status: 204 });
}

function cardActionRoute({ method, path, fallback = noContent, ...control }: CardActionRoute) {
  const sent: string[] = [];
  const handler = http[method](apiUrl(path), (info) => {
    sent.push(String(info.params.id));
    return heldReply({ ...control, info, fallback });
  });
  return { handler, sent };
}

export function retryRoute({ jobId, ...control }: RetryRouteOptions) {
  return cardActionRoute({
    ...control,
    method: 'post',
    path: '/capture/drafts/:id/retry',
    fallback: () => HttpResponse.json<CaptureRetryResponse>({ jobId }, { status: 202 }),
  });
}

export function deleteRoute(control: MoveRouteOptions = {}) {
  return cardActionRoute({ ...control, method: 'delete', path: '/applications/:id' });
}

export function confirmRoute(control: MoveRouteOptions = {}) {
  return cardActionRoute({ ...control, method: 'post', path: '/capture/drafts/:id/confirm' });
}
