import {
  type ApplicationBoardQuery,
  type ApplicationBoardResponse,
  type ApplicationFilters,
  type ApplicationListResponse,
  OUTCOME_STAGES,
  REJECTION_REASONS,
  type RejectionReasonCode,
  rejectionReasonCodeSchema,
  type RejectionReasonsSummary,
  type RejectionReasonsSummaryQuery,
  type SearchSnippet,
  silenceWindows,
  type Stage,
  STAGES,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { type CardContext, toApplicationCard } from './application-card.js';
import {
  type ApplicationCursor,
  type ApplicationListRequest,
  dateCursorOf,
  encodeApplicationCursor,
  encodeRankCursor,
  rankCursorOf,
} from './application-cursor.js';
import {
  type ApplicationListFilter,
  ApplicationListRepository,
  type CardRow,
  type DateSort,
  type ReasonCount,
} from './application-list.repository.js';
import { inRankOrder, rankedPage, type SearchMatch, snippetPartsOf } from './application-search.js';
import { ApplicationSearchRepository } from './application-search.repository.js';

type BoardColumns = ApplicationBoardResponse['columns'];

type ReasonTally = RejectionReasonsSummary['reasons'][number];

type FilterInput = { filters: ApplicationFilters; context: CardContext };

type SearchFilter = { filter: ApplicationListFilter; matches: SearchMatch[] | undefined };

type PageInput = {
  filter: ApplicationListFilter;
  cursor: ApplicationCursor | undefined;
  limit: number;
  now: Date;
};

type DatePageInput = PageInput & { sort: DateSort };

type RelevancePageInput = PageInput & { matches: readonly SearchMatch[] };

type CardPage = { rows: CardRow[]; nextCursor: string | null };

type SnippetInput = { q: string | undefined; rows: readonly CardRow[] };

type SnippetOf = Map<string, SearchSnippet | null>;

const OUTCOMES: readonly Stage[] = OUTCOME_STAGES;

function listFilterOf(
  { silence, ...filters }: Omit<ApplicationFilters, 'q'>,
  { now, silenceDays }: CardContext,
): ApplicationListFilter {
  return silence === undefined
    ? filters
    : { ...filters, silenceWindows: silenceWindows({ levels: silence, silenceDays, now }) };
}

function columnsOf(columnOf: (stage: Stage) => BoardColumns[Stage]): BoardColumns {
  return Object.fromEntries(STAGES.map((stage) => [stage, columnOf(stage)])) as BoardColumns;
}

function byCountThenSortOrder(left: ReasonTally, right: ReasonTally): number {
  return right.count === left.count
    ? REJECTION_REASONS[left.code].sortOrder - REJECTION_REASONS[right.code].sortOrder
    : right.count - left.count;
}

function reasonTalliesOf(rows: ReasonCount[]): ReasonTally[] {
  const counts = new Map<RejectionReasonCode, number>();
  for (const { reasonCode, count } of rows) {
    const code = rejectionReasonCodeSchema.parse(reasonCode ?? 'unspecified');
    counts.set(code, (counts.get(code) ?? 0) + count);
  }
  return [...counts].map(([code, count]) => ({ code, count })).sort(byCountThenSortOrder);
}

@Injectable()
export class ApplicationListService {
  constructor(
    private readonly repository: ApplicationListRepository,
    private readonly search: ApplicationSearchRepository,
    private readonly clock: Clock,
  ) {}

  async list(userId: string, query: ApplicationListRequest): Promise<ApplicationListResponse> {
    const { searchId, sort, limit, cursor, ...filters } = query;
    if (searchId !== undefined && !(await this.repository.searchExists(userId, searchId))) {
      throw notFound('Search not found');
    }
    const context = await this.cardContext(userId);
    const searched = await this.searchFilter(userId, { filters, context });
    const paging = { cursor, limit, now: context.now };
    const filter = { ...searched.filter, ...(searchId === undefined ? {} : { searchId }) };
    const { rows, nextCursor } =
      sort === 'relevance'
        ? await this.relevancePage(userId, { ...paging, filter, matches: searched.matches ?? [] })
        : await this.datePage(userId, { ...paging, filter, sort });
    const snippets = await this.snippetsOf(userId, { q: filters.q, rows });
    return {
      items: rows.map((row) => ({
        ...toApplicationCard(row, context),
        snippet: snippets.get(row.id) ?? null,
      })),
      nextCursor,
    };
  }

  async board(userId: string, query: ApplicationBoardQuery): Promise<ApplicationBoardResponse> {
    const { expand = [], ...filters } = query;
    const context = await this.cardContext(userId);
    const { filter } = await this.searchFilter(userId, { filters, context });
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

  async reasonsSummary(
    userId: string,
    { stage }: RejectionReasonsSummaryQuery,
  ): Promise<RejectionReasonsSummary> {
    const reasons = reasonTalliesOf(await this.repository.countRejectionReasons(userId, { stage }));
    return { stage, total: reasons.reduce((sum, { count }) => sum + count, 0), reasons };
  }

  private async cardContext(userId: string): Promise<CardContext> {
    return { now: this.clock.now(), silenceDays: await this.repository.findSilenceDays(userId) };
  }

  private async searchFilter(
    userId: string,
    { filters: { q, ...filters }, context }: FilterInput,
  ): Promise<SearchFilter> {
    const filter = listFilterOf(filters, context);
    if (q === undefined) {
      return { filter, matches: undefined };
    }
    const matches = await this.search.findMatches(userId, { q });
    return { filter: { ...filter, applicationIds: matches.map(({ id }) => id) }, matches };
  }

  private async datePage(userId: string, input: DatePageInput): Promise<CardPage> {
    const { filter, sort, cursor, limit, now } = input;
    const rows = await this.repository.findCards(userId, {
      filter,
      sort,
      cursor: dateCursorOf(cursor),
      take: limit + 1,
      now,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      rows: page,
      nextCursor: rows.length > limit && last ? encodeApplicationCursor(last) : null,
    };
  }

  private async relevancePage(userId: string, input: RelevancePageInput): Promise<CardPage> {
    const { filter, matches, cursor, limit, now } = input;
    const allowedIds = await this.repository.findIds(userId, filter);
    const ranked = rankedPage({
      matches,
      allowedIds,
      cursor: rankCursorOf(cursor),
      take: limit + 1,
    });
    const page = ranked.slice(0, limit);
    const rows = await this.repository.findCards(userId, {
      filter: { ...filter, applicationIds: page.map(({ id }) => id) },
      sort: '-lastEventAt',
      now,
    });
    const last = page.at(-1);
    return {
      rows: inRankOrder(rows, page),
      nextCursor: ranked.length > limit && last ? encodeRankCursor(last) : null,
    };
  }

  private async snippetsOf(userId: string, { q, rows }: SnippetInput): Promise<SnippetOf> {
    if (q === undefined) {
      return new Map();
    }
    const applicationIds = rows.map(({ id }) => id);
    const headlines = await this.search.findSnippets(userId, { q, applicationIds });
    return new Map(headlines.map(({ id, headline }) => [id, snippetPartsOf(headline)]));
  }
}
