import type { CreateApplicationInput, Stage, UpdateApplicationInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { withoutUndefined } from '../../common/without-undefined.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EFFECTIVE_STAGE_EVENTS } from '../../prisma/effective-stage-events.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { LATEST_AI_JOB_SELECT, UNSETTLED_AI_JOB_STATUSES } from '../../prisma/latest-ai-job.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DraftData } from './application-draft-fields.js';
import { type ApplicationEvent, applicationEvent } from './applications.events.js';

export const LATEST_STAGE_EVENT_SELECT = {
  ...EFFECTIVE_STAGE_EVENTS,
  take: 1,
  select: { occurredAt: true },
} satisfies Prisma.Application$stageEventsArgs;

export const APPLICATION_SELECT = {
  id: true,
  searchId: true,
  company: true,
  position: true,
  url: true,
  source: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  stack: true,
  location: true,
  workMode: true,
  currentStage: true,
  isDraft: true,
  resumeVersionId: true,
  matchScore: true,
  aiParsed: true,
  rawText: true,
  appliedAt: true,
  lastEventAt: true,
  createdAt: true,
  updatedAt: true,
  stageEvents: LATEST_STAGE_EVENT_SELECT,
  user: { select: { settings: { select: { silenceDays: true } } } },
} satisfies Prisma.ApplicationSelect;

export type ApplicationRow = Prisma.ApplicationGetPayload<{ select: typeof APPLICATION_SELECT }>;

export type CreateDefaults = { searchId: string | null; resumeVersionId: string | null };

export type ApplicationFields = CreateApplicationInput & { isDraft?: boolean; rawText?: string };

export type NewApplication = ApplicationFields & {
  searchId: string;
  resumeVersionId: string | null;
  currentStage: Stage;
  appliedAt: Date;
  lastEventAt: Date;
};

export type FirstStageEvent = { fromStage: null; toStage: Stage; occurredAt: Date };

export type ApplicationChanges = Omit<UpdateApplicationInput, 'currentStage'>;

export type InsertApplication = InTransaction & {
  application: NewApplication;
  firstEvent: FirstStageEvent;
};

export type RecordApplicationEvent = InTransaction & { event: ApplicationEvent };

export type RecordApplicationEvents = InTransaction & { events: readonly ApplicationEvent[] };

export type ApplicationById = InTransaction & { id: string };

export type UpdateApplicationById = ApplicationById & { data: ApplicationChanges };

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
  status: { in: UNSETTLED_AI_JOB_STATUSES },
} satisfies Prisma.AiJobWhereInput;

export type SoftDeleteApplication = ApplicationById & { deletedAt: Date };

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCreateDefaults(
    userId: string,
    { tx = this.prisma }: InTransaction = {},
  ): Promise<CreateDefaults> {
    const search = await tx.search.findFirst({
      where: { userId, status: 'active' },
      select: { id: true },
    });
    const settings = await tx.userSettings.findUnique({
      where: { userId },
      select: { activeResumeVersionId: true },
    });
    return {
      searchId: search?.id ?? null,
      resumeVersionId: settings?.activeResumeVersionId ?? null,
    };
  }

  insert(
    userId: string,
    { application, firstEvent, tx = this.prisma }: InsertApplication,
  ): Promise<ApplicationRow> {
    return tx.application.create({
      data: { ...withoutUndefined(application), userId, stageEvents: { create: firstEvent } },
      select: APPLICATION_SELECT,
    });
  }

  async recordEvent(
    userId: string,
    { event, tx = this.prisma }: RecordApplicationEvent,
  ): Promise<void> {
    await tx.outboxEvent.create({ data: applicationEvent(userId, event), select: { id: true } });
  }

  async recordEvents(
    userId: string,
    { events, tx = this.prisma }: RecordApplicationEvents,
  ): Promise<void> {
    await tx.outboxEvent.createMany({
      data: events.map((event) => applicationEvent(userId, event)),
    });
  }

  findOwned(
    userId: string,
    { id, tx = this.prisma }: ApplicationById,
  ): Promise<ApplicationRow | null> {
    return tx.application.findFirst({
      where: { id, userId, deletedAt: null },
      select: APPLICATION_SELECT,
    });
  }

  async updateOwned(
    userId: string,
    { id, data, tx = this.prisma }: UpdateApplicationById,
  ): Promise<number> {
    const { count } = await tx.application.updateMany({
      where: { id, userId, deletedAt: null },
      data: withoutUndefined(data),
    });
    return count;
  }

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
    const [running] = await tx.aiJob.findMany({
      where: { ...RUNNING_PARSE, applicationId: id, userId },
      ...LATEST_AI_JOB_SELECT,
    });
    return { ...draft, runningJobId: running?.id ?? null };
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

  async softDelete(
    userId: string,
    { id, deletedAt, tx = this.prisma }: SoftDeleteApplication,
  ): Promise<number> {
    const { count } = await tx.application.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt },
    });
    return count;
  }
}
