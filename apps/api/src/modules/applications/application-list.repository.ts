import {
  type ApplicationFilters,
  type ApplicationListQuery,
  DEFAULT_SILENCE_DAYS,
  type SilenceWindow,
  type Stage,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ApplicationCursor } from './application-cursor.js';
import { LATEST_STAGE_EVENT_SELECT } from './applications.repository.js';

export type ApplicationListFilter = Omit<ApplicationFilters, 'silence'> & {
  searchId?: string | undefined;
  silenceWindows?: readonly SilenceWindow[] | undefined;
};

export type ApplicationSort = ApplicationListQuery['sort'];

export type FindCards = {
  filter: ApplicationListFilter;
  sort: ApplicationSort;
  now: Date;
  stages?: readonly Stage[];
  cursor?: ApplicationCursor | undefined;
  take?: number;
};

export type StageCount = { stage: Stage; count: number };

type Where = Prisma.ApplicationWhereInput;

type ListWhere = { filter: ApplicationListFilter; also?: Where[] };

const SORT_DIRECTION = {
  '-lastEventAt': 'desc',
  lastEventAt: 'asc',
} as const satisfies Record<ApplicationSort, Prisma.SortOrder>;

function cardSelectAt(now: Date) {
  return {
    id: true,
    company: true,
    position: true,
    source: true,
    salaryMin: true,
    salaryMax: true,
    currency: true,
    stack: true,
    matchScore: true,
    currentStage: true,
    isDraft: true,
    appliedAt: true,
    lastEventAt: true,
    createdAt: true,
    stageEvents: LATEST_STAGE_EVENT_SELECT,
    scheduledEvents: {
      where: { status: 'planned', startsAt: { gte: now } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 1,
      select: { kind: true, startsAt: true },
    },
    aiJobs: {
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
      select: { status: true },
    },
  } satisfies Prisma.ApplicationSelect;
}

export type CardRow = Prisma.ApplicationGetPayload<{ select: ReturnType<typeof cardSelectAt> }>;

function silenceWindowWhere({ stages, lastEventAtOrBefore, lastEventAfter }: SilenceWindow): Where {
  return {
    currentStage: { in: [...stages] },
    lastEventAt: {
      ...(lastEventAtOrBefore === undefined ? {} : { lte: lastEventAtOrBefore }),
      ...(lastEventAfter === undefined ? {} : { gt: lastEventAfter }),
    },
  };
}

function likeLiteralOf(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function textWhere(q: string): Where {
  const contains = { contains: likeLiteralOf(q), mode: 'insensitive' } as const;
  return { OR: [{ company: contains }, { position: contains }] };
}

function filterWhere({
  stage,
  source,
  q,
  hasScore,
  silenceWindows,
}: ApplicationListFilter): Where[] {
  const conditions: (Where | undefined)[] = [
    stage && { currentStage: { in: stage } },
    source && { source: { in: source } },
    q === undefined ? undefined : textWhere(q),
    hasScore === undefined ? undefined : { matchScore: hasScore ? { not: null } : null },
    silenceWindows && { OR: silenceWindows.map(silenceWindowWhere) },
  ];
  return conditions.filter((condition) => condition !== undefined);
}

function listWhere(userId: string, { filter, also = [] }: ListWhere): Where {
  const scope: Where =
    filter.searchId === undefined
      ? { search: { status: 'active' } }
      : { searchId: filter.searchId };
  return { userId, deletedAt: null, ...scope, AND: [...filterWhere(filter), ...also] };
}

function afterCursor({ lastEventAt, id }: ApplicationCursor, direction: Prisma.SortOrder): Where {
  const beyond = <Value>(value: Value) => (direction === 'desc' ? { lt: value } : { gt: value });
  return { OR: [{ lastEventAt: beyond(lastEventAt) }, { lastEventAt, id: beyond(id) }] };
}

@Injectable()
export class ApplicationListRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSilenceDays(userId: string): Promise<number> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { silenceDays: true },
    });
    return settings?.silenceDays ?? DEFAULT_SILENCE_DAYS;
  }

  async searchExists(userId: string, searchId: string): Promise<boolean> {
    const count = await this.prisma.search.count({ where: { id: searchId, userId } });
    return count > 0;
  }

  async countByStage(userId: string, filter: ApplicationListFilter): Promise<StageCount[]> {
    const groups = await this.prisma.application.groupBy({
      by: ['currentStage'],
      where: listWhere(userId, { filter }),
      _count: { _all: true },
    });
    return groups.map(({ currentStage, _count }) => ({ stage: currentStage, count: _count._all }));
  }

  findCards(userId: string, query: FindCards): Promise<CardRow[]> {
    const { filter, sort, now, stages, cursor, take } = query;
    const direction = SORT_DIRECTION[sort];
    const also: Where[] = [
      ...(stages === undefined ? [] : [{ currentStage: { in: [...stages] } }]),
      ...(cursor === undefined ? [] : [afterCursor(cursor, direction)]),
    ];
    return this.prisma.application.findMany({
      where: listWhere(userId, { filter, also }),
      orderBy: [{ lastEventAt: direction }, { id: direction }],
      ...(take === undefined ? {} : { take }),
      select: cardSelectAt(now),
    });
  }
}
