import {
  APPLICATION_CARD_STACK_LIMIT,
  type ApplicationBoardQuery,
  type ApplicationBoardResponse,
  type ApplicationCard,
  type ApplicationFilters,
  type ApplicationListResponse,
  OUTCOME_STAGES,
  silenceWindows,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { type ApplicationListRequest, encodeApplicationCursor } from './application-cursor.js';
import {
  type ApplicationListFilter,
  ApplicationListRepository,
  type CardRow,
} from './application-list.repository.js';
import { withApplicationTiming } from './application-timing.js';

type BoardColumns = ApplicationBoardResponse['columns'];

type CardContext = { now: Date; silenceDays: number };

const OUTCOMES: readonly Stage[] = OUTCOME_STAGES;

function toApplicationCard(row: CardRow, { now, silenceDays }: CardContext): ApplicationCard {
  const { scheduledEvents, aiJobs, stack, appliedAt, lastEventAt, ...columns } =
    withApplicationTiming({ row, silenceDays, now });
  const [nextEvent] = scheduledEvents;
  return {
    ...columns,
    appliedAt: appliedAt?.toISOString() ?? null,
    lastEventAt: lastEventAt.toISOString(),
    stack: stack.slice(0, APPLICATION_CARD_STACK_LIMIT),
    stackCount: stack.length,
    nextScheduledEvent: nextEvent
      ? { kind: nextEvent.kind, startsAt: nextEvent.startsAt.toISOString() }
      : null,
    aiStatus: aiJobs[0]?.status ?? null,
  };
}

function listFilterOf(
  { silence, ...filters }: ApplicationFilters,
  { now, silenceDays }: CardContext,
): ApplicationListFilter {
  return silence === undefined
    ? filters
    : { ...filters, silenceWindows: silenceWindows({ levels: silence, silenceDays, now }) };
}

function columnsOf(columnOf: (stage: Stage) => BoardColumns[Stage]): BoardColumns {
  return Object.fromEntries(STAGES.map((stage) => [stage, columnOf(stage)])) as BoardColumns;
}

@Injectable()
export class ApplicationListService {
  constructor(
    private readonly repository: ApplicationListRepository,
    private readonly clock: Clock,
  ) {}

  async list(userId: string, query: ApplicationListRequest): Promise<ApplicationListResponse> {
    const { searchId, sort, limit, cursor, ...filters } = query;
    if (searchId !== undefined && !(await this.repository.searchExists(userId, searchId))) {
      throw notFound('Search not found');
    }
    const context = await this.cardContext(userId);
    const rows = await this.repository.findCards(userId, {
      filter: {
        ...listFilterOf(filters, context),
        ...(searchId === undefined ? {} : { searchId }),
      },
      sort,
      cursor,
      take: limit + 1,
      now: context.now,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => toApplicationCard(row, context)),
      nextCursor: rows.length > limit && last ? encodeApplicationCursor(last) : null,
    };
  }

  async board(userId: string, query: ApplicationBoardQuery): Promise<ApplicationBoardResponse> {
    const { expand = [], ...filters } = query;
    const context = await this.cardContext(userId);
    const filter = listFilterOf(filters, context);
    const collapsed = OUTCOMES.filter((stage) => !expand.some((expanded) => expanded === stage));
    const stages = STAGES.filter((stage) => !collapsed.includes(stage));
    const [counts, rows] = await Promise.all([
      this.repository.countByStage(userId, filter),
      this.repository.findCards(userId, { filter, stages, sort: '-lastEventAt', now: context.now }),
    ]);
    const countOf = new Map(counts.map(({ stage, count }) => [stage, count]));
    const cards = rows.map((row) => toApplicationCard(row, context));
    return {
      columns: columnsOf((stage) => ({
        count: countOf.get(stage) ?? 0,
        items: collapsed.includes(stage)
          ? null
          : cards.filter((card) => card.currentStage === stage),
      })),
    };
  }

  private async cardContext(userId: string): Promise<CardContext> {
    return { now: this.clock.now(), silenceDays: await this.repository.findSilenceDays(userId) };
  }
}
