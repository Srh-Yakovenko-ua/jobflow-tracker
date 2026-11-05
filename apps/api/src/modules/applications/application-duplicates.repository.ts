import type { CreateApplicationInput, PossibleDuplicate } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

export const DUPLICATE_LIMITS = { windowDays: 90, positionSimilarity: 0.6, maxItems: 5 } as const;

export type DuplicateProbe = Pick<CreateApplicationInput, 'url'> &
  Partial<Pick<CreateApplicationInput, 'company' | 'position'>>;

export type DuplicateQuery = DuplicateProbe & { since: Date };

export type DuplicateRow = Omit<PossibleDuplicate, 'appliedAt'> & { appliedAt: Date | null };

@Injectable()
export class ApplicationDuplicatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPossible(
    userId: string,
    { url, company, position, since }: DuplicateQuery,
  ): Promise<DuplicateRow[]> {
    return this.prisma.$queryRaw<DuplicateRow[]>`
      SELECT a.id, a.company, a.position, a.current_stage::text AS stage, a.applied_at AS "appliedAt"
      FROM applications a
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
        AND (jobflow_url_key(a.url) = jobflow_url_key(${url ?? null}::text)
          OR (jobflow_company_key(a.company) = jobflow_company_key(${company ?? null}::text)
            AND similarity(a.position, ${position ?? null}::text) > ${DUPLICATE_LIMITS.positionSimilarity}::real
            AND coalesce(a.applied_at, a.created_at) >= ${since}::timestamptz))
      ORDER BY coalesce(a.applied_at, a.created_at) DESC, a.id DESC
      LIMIT ${DUPLICATE_LIMITS.maxItems}::int`;
  }
}
