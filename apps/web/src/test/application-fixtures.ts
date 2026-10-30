import {
  type ApplicationResponse,
  applicationResponseSchema,
  moveApplicationInputSchema,
  updateApplicationInputSchema,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { applicationResponseOf, heldReply, type MoveRouteOptions } from './board-fixtures';

export type ApplicationRouteOptions = {
  application: ApplicationResponse;
  moves?: readonly unknown[];
  reply?: HttpResponseResolver;
};

export type UpdateRouteOptions = MoveRouteOptions & { application: ApplicationResponse };

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

export function applicationRoute({ application, moves = [], reply }: ApplicationRouteOptions) {
  const sent: string[] = [];
  const handler = http.get(apiUrl(`/applications/${application.id}`), (info) => {
    sent.push(application.id);
    if (reply !== undefined) return reply(info);
    const last = moves.at(-1);
    const currentStage =
      last === undefined
        ? application.currentStage
        : moveApplicationInputSchema.parse(last).toStage;
    return HttpResponse.json({ ...application, currentStage });
  });
  return { handler, sent };
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

export function deleteRoute(control: MoveRouteOptions = {}) {
  const sent: string[] = [];
  const handler = http.delete<{ id: string }>(apiUrl('/applications/:id'), (info) => {
    sent.push(info.params.id);
    return heldReply({
      ...control,
      info,
      fallback: () => new HttpResponse(null, { status: 204 }),
    });
  });
  return { handler, sent };
}
