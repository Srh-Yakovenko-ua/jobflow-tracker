import { AI_JOB_STEPS } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { InTransaction } from '../prisma/in-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoCompletion } from './demo-ai.js';
import type { DemoApplicationRow } from './demo-rows.js';

type InDemoTransaction = Required<InTransaction>;

export type DemoUserLookup = InDemoTransaction & { email: string };

export type NewDemoApplication = InDemoTransaction & {
  searchId: string;
  resumeVersionId: string | null;
  matchScore: number;
  row: DemoApplicationRow;
};

export type DemoAiRun = {
  completion: DemoCompletion;
  at: Date;
  applicationId: string | null;
  resumeVersionId: string | null;
};

export type NewDemoAiRuns = InDemoTransaction & { runs: DemoAiRun[] };

export type DemoSettings = InDemoTransaction & {
  activeResumeVersionId: string | null;
  timezone: string;
};

@Injectable()
export class DemoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserId({ email, tx }: DemoUserLookup): Promise<string | null> {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }

  async wipe(userId: string, { tx }: InDemoTransaction): Promise<void> {
    await tx.plan.deleteMany({ where: { userId } });
    await tx.aiJob.deleteMany({ where: { userId } });
    await tx.aiResult.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.search.deleteMany({ where: { userId } });
    await tx.resume.deleteMany({ where: { userId } });
  }

  async createApplication(
    userId: string,
    { searchId, resumeVersionId, matchScore, row, tx }: NewDemoApplication,
  ): Promise<string> {
    const { stageEvents, notes, scheduledEvents, ...fields } = row;
    const { id } = await tx.application.create({
      data: {
        ...fields,
        userId,
        searchId,
        resumeVersionId,
        matchScore,
        stageEvents: { createMany: { data: stageEvents } },
        notes: { createMany: { data: notes } },
        scheduledEvents: { createMany: { data: scheduledEvents } },
      },
      select: { id: true },
    });
    return id;
  }

  async createAiRuns(userId: string, { runs, tx }: NewDemoAiRuns): Promise<Map<string, string>> {
    const results = await tx.aiResult.createManyAndReturn({
      data: runs.map(({ completion, at }) => ({
        ...completion,
        userId,
        status: 'succeeded',
        createdAt: at,
        updatedAt: at,
      })),
      select: { id: true, inputHash: true },
    });
    const resultIds = new Map(results.map(({ id, inputHash }) => [inputHash, id]));
    await tx.aiJob.createMany({
      data: runs.map(({ completion: { kind, inputHash }, at, applicationId, resumeVersionId }) => ({
        userId,
        kind,
        applicationId,
        resumeVersionId,
        aiResultId: resultIds.get(inputHash) ?? null,
        status: 'done',
        step: AI_JOB_STEPS.done,
        createdAt: at,
        startedAt: at,
        finishedAt: at,
      })),
    });
    return resultIds;
  }

  async updateSettings(
    userId: string,
    { activeResumeVersionId, timezone, tx }: DemoSettings,
  ): Promise<number> {
    const { count } = await tx.userSettings.updateMany({
      where: { userId },
      data: { activeResumeVersionId, timezone },
    });
    return count;
  }
}
