import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { LATEST_AI_JOB_SELECT, UNSETTLED_AI_JOB_WHERE } from '../../prisma/latest-ai-job.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DraftData } from './application-draft-fields.js';
import type { ApplicationById } from './applications.repository.js';

const DRAFT_SELECT = {
  createdAt: true,
  company: true,
  position: true,
  source: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  stack: true,
  location: true,
  workMode: true,
} satisfies Prisma.ApplicationSelect;

export type DraftRow = Prisma.ApplicationGetPayload<{ select: typeof DRAFT_SELECT }>;

export type FillDraft = ApplicationById & {
  data: Pick<DraftData, 'aiParsed'> & { isDraft: boolean };
};

type DraftFlags = { isDraft: boolean; parsed: boolean; hasText: boolean };

export type LockedDraft = DraftFlags & { runningJobId: string | null };

const RUNNING_PARSE = {
  kind: 'vacancy_parse',
  ...UNSETTLED_AI_JOB_WHERE,
} satisfies Prisma.AiJobWhereInput;

@Injectable()
export class ApplicationDraftsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fillDraft(
    userId: string,
    { id, data, tx = this.prisma }: FillDraft,
  ): Promise<DraftRow | null> {
    const [draft] = await tx.application.updateManyAndReturn({
      where: { id, userId, deletedAt: null, isDraft: true, aiParsed: { equals: Prisma.DbNull } },
      data,
      select: DRAFT_SELECT,
    });
    return draft ?? null;
  }

  async lockDraft(
    userId: string,
    { id, tx = this.prisma }: ApplicationById,
  ): Promise<LockedDraft | null> {
    const [draft] = await tx.$queryRaw<DraftFlags[]>`
      SELECT is_draft AS "isDraft", ai_parsed IS NOT NULL AS "parsed",
        raw_text IS NOT NULL AS "hasText"
      FROM applications
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    if (draft === undefined) {
      return null;
    }
    const parses = await tx.application.findFirst({
      where: { id, userId },
      select: { aiJobs: { where: RUNNING_PARSE, ...LATEST_AI_JOB_SELECT } },
    });
    return { ...draft, runningJobId: parses?.aiJobs[0]?.id ?? null };
  }

  async confirmDraft(userId: string, { id, tx = this.prisma }: ApplicationById): Promise<number> {
    const { count } = await tx.application.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
        isDraft: true,
        aiJobs: { none: RUNNING_PARSE },
      },
      data: { isDraft: false },
    });
    return count;
  }
}
