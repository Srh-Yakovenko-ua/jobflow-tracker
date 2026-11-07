import { DEFAULT_SEARCH_TITLE, type SearchOutcome } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type ActiveSearch = { id: string };

export type SearchById = InTransaction & { id: string };

export type ArchiveSearch = SearchById & { outcome: SearchOutcome; finishedAt: Date };

export type CreateActiveSearch = InTransaction & { startedAt: Date };

export const SEARCH_SELECT = {
  id: true,
  title: true,
  status: true,
  outcome: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.SearchSelect;

export type SearchRow = Prisma.SearchGetPayload<{ select: typeof SEARCH_SELECT }>;

@Injectable()
export class SearchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockActive(
    userId: string,
    { tx = this.prisma }: InTransaction = {},
  ): Promise<ActiveSearch | null> {
    const [active = null] = await tx.$queryRaw<ActiveSearch[]>`
      SELECT id FROM searches
      WHERE user_id = ${userId}::uuid AND status = 'active'
      FOR UPDATE`;
    return active;
  }

  archive(
    userId: string,
    { id, outcome, finishedAt, tx = this.prisma }: ArchiveSearch,
  ): Promise<SearchRow> {
    return tx.search.update({
      where: { id, userId, status: 'active' },
      data: { status: 'archived', outcome, finishedAt },
      select: SEARCH_SELECT,
    });
  }

  createActive(
    userId: string,
    { startedAt, tx = this.prisma }: CreateActiveSearch,
  ): Promise<SearchRow> {
    return tx.search.create({
      data: { userId, title: DEFAULT_SEARCH_TITLE, startedAt },
      select: SEARCH_SELECT,
    });
  }

  findAll(userId: string): Promise<SearchRow[]> {
    return this.prisma.search.findMany({
      where: { userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: SEARCH_SELECT,
    });
  }
}
