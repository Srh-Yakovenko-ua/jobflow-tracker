import {
  applicationBoardQuerySchema,
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type ApplicationCard,
  type ApplicationResponse,
  applicationResponseSchema,
  moveApplicationInputSchema,
  OPEN_STAGES,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { FULL_CARD } from '@/entities/application';

import { apiUrl } from './api-handlers';
import type { Latch } from './latch';

export type ColumnCounts = Partial<Record<Stage, number>>;

export type CardSeed = { serial: number; stage: Stage; position: string };

export function cardIn({ serial, stage, position }: CardSeed): ApplicationCard {
  const id = `0b6f3c1e-5d2a-4c8e-9f10-${String(serial).padStart(12, '0')}`;
  return { ...FULL_CARD, id, position, currentStage: stage };
}

export type ShownCards = { cards: readonly ApplicationCard[]; stages: readonly Stage[] };

export type BoardRouteOptions = { counts: ColumnCounts; cards?: readonly ApplicationCard[] };

function itemsOf(stage: Stage, shown: ShownCards | undefined): ApplicationCard[] | null {
  if (shown === undefined || !shown.stages.includes(stage)) {
    return null;
  }
  return shown.cards.filter((card) => card.currentStage === stage);
}

export function boardOf(counts: ColumnCounts, shown?: ShownCards): ApplicationBoardResponse {
  return applicationBoardResponseSchema.parse({
    columns: Object.fromEntries(
      STAGES.map((stage) => [stage, { count: counts[stage] ?? 0, items: itemsOf(stage, shown) }]),
    ),
  });
}

export type MoveRouteOptions = { reply?: HttpResponseResolver; latch?: Latch };

type MovedCard = Pick<ApplicationResponse, 'id' | 'currentStage'>;

export const DESIGN_BOARD: BoardRouteOptions = {
  counts: { applied: 2, screening: 1, tech_interview: 1, offer: 1, rejected: 32, ghosted: 17 },
  cards: [
    cardIn({ serial: 101, stage: 'applied', position: 'Senior Frontend Engineer' }),
    cardIn({ serial: 102, stage: 'applied', position: 'Product Designer' }),
    cardIn({ serial: 103, stage: 'screening', position: 'Go Backend Engineer' }),
    cardIn({ serial: 104, stage: 'tech_interview', position: 'Platform Engineer' }),
    cardIn({ serial: 105, stage: 'offer', position: 'Frontend Engineer' }),
    cardIn({ serial: 106, stage: 'rejected', position: 'Middle QA Engineer' }),
  ],
};

export const DESIGN_BOARD_HEADINGS: readonly string[] = [
  'відгук 2',
  'скринінг 1',
  "техінтерв'ю 1",
  'фінал 0',
  'офер 1',
  'відмова 32',
  'ghosted 17',
  'відкликав 0',
];

function movedApplication({ id, currentStage }: MovedCard): ApplicationResponse {
  return applicationResponseSchema.parse({
    ...FULL_CARD,
    id,
    currentStage,
    searchId: '0b6f3c1e-5d2a-4c8e-9f10-0000000000ff',
    url: null,
    location: null,
    workMode: null,
    resumeVersionId: null,
    aiParsed: null,
    rawText: null,
    createdAt: FULL_CARD.lastEventAt,
    updatedAt: FULL_CARD.lastEventAt,
  });
}

export function moveRoute({ reply, latch }: MoveRouteOptions = {}) {
  const sent: unknown[] = [];
  const handler = http.post<{ id: string }>(apiUrl('/applications/:id/events'), async (info) => {
    const body: unknown = await info.request.json();
    sent.push(body);
    await latch?.reached;
    if (reply !== undefined) {
      return reply(info);
    }
    const { toStage } = moveApplicationInputSchema.parse(body);
    return HttpResponse.json(movedApplication({ id: info.params.id, currentStage: toStage }));
  });
  return { handler, sent };
}

export function boardRoute({ counts, cards = [] }: BoardRouteOptions) {
  const sent: string[] = [];
  const handler = http.get(apiUrl('/applications/board'), ({ request }) => {
    const { searchParams } = new URL(request.url);
    sent.push(searchParams.toString());
    const { expand = [] } = applicationBoardQuerySchema.parse(Object.fromEntries(searchParams));
    return HttpResponse.json(boardOf(counts, { cards, stages: [...OPEN_STAGES, ...expand] }));
  });
  return { handler, sent };
}
