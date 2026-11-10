import {
  applicationBoardQuerySchema,
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type ApplicationResponse,
  applicationResponseSchema,
  type BoardCard,
  moveApplicationInputSchema,
  OPEN_STAGES,
  type RejectionReasonsSummary,
  rejectionReasonsSummaryQuerySchema,
  type SearchSnippet,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { FULL_APPLICATION, FULL_CARD } from '@/entities/application';

import { apiUrl, errorReply } from './api-handlers';
import type { Latch } from './latch';

export type ColumnCounts = Partial<Record<Stage, number>>;

export type CardSeed = { serial: number; stage: Stage; position: string };

export const KAFKA_SNIPPET: SearchSnippet = [
  { text: 'Queues on ', match: false },
  { text: 'Kafka', match: true },
  { text: ' and Postgres', match: false },
];

export function fixtureIdOf(serial: number): string {
  return `0b6f3c1e-5d2a-4c8e-9f10-${String(serial).padStart(12, '0')}`;
}

export function cardIn({ serial, stage, position }: CardSeed): BoardCard {
  return { ...FULL_CARD, id: fixtureIdOf(serial), position, currentStage: stage };
}

export function snippetCardIn(seed: CardSeed): BoardCard {
  return { ...cardIn(seed), snippet: KAFKA_SNIPPET };
}

export type CardRun = { stage: Stage; count: number; from: number };

export function cardsIn({ stage, count, from }: CardRun): BoardCard[] {
  return Array.from({ length: count }, (_, offset) => {
    const serial = from + offset;
    return cardIn({ serial, stage, position: `Vacancy ${String(serial)}` });
  });
}

export type ShownCards = { cards: readonly BoardCard[]; stages: readonly Stage[] };

export type BoardRouteOptions = {
  counts: ColumnCounts;
  cards?: readonly BoardCard[];
  emptyFor?: readonly string[];
  failFor?: readonly string[];
  liveCard?: (card: BoardCard) => BoardCard;
};

function itemsOf(stage: Stage, shown: ShownCards | undefined): BoardCard[] | null {
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

export type ReasonsSummaryRouteOptions = MoveRouteOptions & {
  reasons?: RejectionReasonsSummary['reasons'];
};

type ResolverInfo = Parameters<HttpResponseResolver>[0];

type HeldReply = MoveRouteOptions & { info: ResolverInfo; fallback: () => Response };

const UNDONE_TO: Stage = 'applied';

export async function heldReply({ info, reply, latch, fallback }: HeldReply) {
  await latch?.reached;
  return reply === undefined ? fallback() : reply(info);
}

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

export function applicationResponseOf(fields: Partial<ApplicationResponse>): ApplicationResponse {
  return applicationResponseSchema.parse({ ...FULL_APPLICATION, ...fields });
}

export function moveRoute(control: MoveRouteOptions = {}) {
  const sent: unknown[] = [];
  const handler = http.post<{ id: string }>(apiUrl('/applications/:id/events'), async (info) => {
    const body: unknown = await info.request.json();
    sent.push(body);
    const { toStage } = moveApplicationInputSchema.parse(body);
    const moved = applicationResponseOf({ id: info.params.id, currentStage: toStage });
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(moved) });
  });
  return { handler, sent };
}

export function undoRoute(control: MoveRouteOptions = {}) {
  const sent: { id: string; body: string }[] = [];
  const path = '/applications/:id/events/undo-last';
  const handler = http.post<{ id: string }>(apiUrl(path), async (info) => {
    sent.push({ id: info.params.id, body: await info.request.text() });
    const restored = applicationResponseOf({ id: info.params.id, currentStage: UNDONE_TO });
    return heldReply({
      ...control,
      info,
      fallback: () => HttpResponse.json(restored, { status: 201 }),
    });
  });
  return { handler, sent };
}

export function reasonsSummaryRoute({ reasons = [], ...control }: ReasonsSummaryRouteOptions = {}) {
  const sent: Stage[] = [];
  const handler = http.get(apiUrl('/applications/reasons-summary'), (info) => {
    const query = Object.fromEntries(new URL(info.request.url).searchParams);
    const { stage } = rejectionReasonsSummaryQuerySchema.parse(query);
    sent.push(stage);
    const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
    const summary: RejectionReasonsSummary = { stage, total, reasons };
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(summary) });
  });
  return { handler, sent };
}

export function boardRoute({
  counts,
  cards = [],
  emptyFor = [],
  failFor = [],
  liveCard = (card) => card,
}: BoardRouteOptions) {
  const sent: string[] = [];
  const handler = http.get(apiUrl('/applications/board'), ({ request }) => {
    const { searchParams } = new URL(request.url);
    sent.push(searchParams.toString());
    const asked = (names: readonly string[]) => names.some((name) => searchParams.has(name));
    if (asked(failFor)) {
      return errorReply({ status: 500, type: 'internal_error' });
    }
    const { expand = [] } = applicationBoardQuerySchema.parse(Object.fromEntries(searchParams));
    const stages = [...OPEN_STAGES, ...expand];
    const shown = { cards: cards.map(liveCard), stages };
    const board = asked(emptyFor) ? boardOf({}) : boardOf(counts, shown);
    return HttpResponse.json(board);
  });
  return { handler, sent };
}
