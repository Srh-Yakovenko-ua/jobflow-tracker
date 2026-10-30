import {
  applicationBoardQuerySchema,
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type ApplicationCard,
  OPEN_STAGES,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { FULL_CARD } from '@/entities/application';

import { apiUrl } from './api-handlers';

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
