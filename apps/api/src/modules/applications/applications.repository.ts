import type { CreateApplicationInput, Stage, UpdateApplicationInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type ApplicationEvent, applicationEvent } from './applications.events.js';

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
  stageEvents: {
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { occurredAt: true },
  },
  user: { select: { settings: { select: { silenceDays: true } } } },
} satisfies Prisma.ApplicationSelect;

export type ApplicationRow = Prisma.ApplicationGetPayload<{ select: typeof APPLICATION_SELECT }>;

export type CreateDefaults = { searchId: string | null; resumeVersionId: string | null };

export type NewApplication = CreateApplicationInput & {
  searchId: string;
  resumeVersionId: string | null;
  currentStage: Stage;
  appliedAt: Date;
  lastEventAt: Date;
};

export type FirstStageEvent = { fromStage: null; toStage: Stage; occurredAt: Date };

export type ApplicationChanges = Omit<UpdateApplicationInput, 'currentStage'>;

export type InTransaction = { tx?: Prisma.TransactionClient };

export type InsertApplication = InTransaction & {
  application: NewApplication;
  firstEvent: FirstStageEvent;
};

export type RecordApplicationEvent = InTransaction & { event: ApplicationEvent };

export type ApplicationById = InTransaction & { id: string };

export type UpdateApplicationById = ApplicationById & { data: ApplicationChanges };

export type SoftDeleteApplication = ApplicationById & { deletedAt: Date };

type WithoutUndefined<T> = { [Key in keyof T]: Exclude<T[Key], undefined> };

function withoutUndefined<T extends object>(value: T): WithoutUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as WithoutUndefined<T>;
}

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
