import {
  type FinishSearchInput,
  type FinishSearchResponse,
  type SearchListResponse,
  searchOutcomeSchema,
  type SearchSummary,
  wholeDaysBetween,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict, notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SearchApplicationsService, type SearchTotals } from '../applications/index.js';
import { SearchesRepository, type SearchRow } from './searches.repository.js';

type FinishStep = { input: FinishSearchInput; now: Date; tx: Prisma.TransactionClient };

type FinishedSearches = { finished: SearchRow; current: SearchRow };

type ActiveSearchLock = { searchId: string; tx: Prisma.TransactionClient };

type SummaryInput = { row: SearchRow; totals: SearchTotals; now: Date };

type SummaryRequest = { rows: SearchRow[]; now: Date };

function toSearchSummary({ row, totals, now }: SummaryInput): SearchSummary {
  const { outcome, startedAt, finishedAt, ...search } = row;
  const { firstOfferAt, ...counts } = totals;
  return {
    ...search,
    ...counts,
    outcome: searchOutcomeSchema.nullable().parse(outcome),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt?.toISOString() ?? null,
    days: wholeDaysBetween(startedAt, finishedAt ?? now),
    daysToOffer: firstOfferAt === null ? null : wholeDaysBetween(startedAt, firstOfferAt),
  };
}

@Injectable()
export class SearchesService {
  constructor(
    private readonly repository: SearchesRepository,
    private readonly searchApplications: SearchApplicationsService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<SearchListResponse> {
    const now = this.clock.now();
    const rows = await this.repository.findAll(userId);
    const summaryOf = await this.summaries(userId, { rows, now });
    return { items: rows.map(summaryOf) };
  }

  async finish(userId: string, input: FinishSearchInput): Promise<FinishSearchResponse> {
    const now = this.clock.now();
    const { finished, current } = await this.prisma.$transaction((tx) =>
      this.finished(userId, { input, now, tx }),
    );
    const summaryOf = await this.summaries(userId, { rows: [finished, current], now });
    return { finished: summaryOf(finished), current: summaryOf(current) };
  }

  private async finished(userId: string, step: FinishStep): Promise<FinishedSearches> {
    const { input, now, tx } = step;
    const { searchId, outcome, openApplications } = input;
    await this.lockActive(userId, { searchId, tx });
    const finished = await this.repository.archive(userId, {
      id: searchId,
      outcome,
      finishedAt: now,
      tx,
    });
    const current = await this.repository.createActive(userId, { startedAt: now, tx });
    await this.searchApplications.handOver(userId, {
      fromSearchId: finished.id,
      toSearchId: current.id,
      choice: openApplications,
      now,
      tx,
    });
    return { finished, current };
  }

  private async lockActive(userId: string, { searchId, tx }: ActiveSearchLock): Promise<void> {
    const active = await this.repository.lockActive(userId, { tx });
    if (active?.id === searchId) return;
    const owned = await this.searchApplications.searchExists(userId, { searchId, tx });
    throw owned ? conflict('The search is already finished') : notFound('Search not found');
  }

  private async summaries(userId: string, { rows, now }: SummaryRequest) {
    const totalsOf = await this.searchApplications.totalsOf(
      userId,
      rows.map(({ id }) => id),
    );
    return (row: SearchRow) => toSearchSummary({ row, totals: totalsOf(row.id), now });
  }
}
