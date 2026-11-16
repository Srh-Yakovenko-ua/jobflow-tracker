import { getQueueToken } from '@nestjs/bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { storedFailureSettledAt } from '../test/ai.js';
import { useTestDatabase } from '../test/database.js';
import { createAiJob, createUser, type NewAiJob } from '../test/factories.js';
import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { StubQueue } from '../test/stub-queues.js';
import { DAY_MINUTES, daysBefore, fixedClock, minutesBefore, NOW } from '../test/time.js';
import { AiJobsSweepService } from './ai-jobs-sweep.service.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';

const log = memoryLog();

describe('AiJobsSweepService on the database', () => {
  const database = useTestDatabase();
  const aiQueue = new StubQueue('ai');
  let service: AiJobsSweepService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      AiJobsSweepService,
      ScheduledJobsRepository,
      { provide: PrismaService, useValue: database.prisma },
      { provide: Clock, useValue: fixedClock(NOW) },
      { provide: getQueueToken('ai'), useValue: aiQueue },
    ]);
    service = moduleRef.get(AiJobsSweepService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('fails queued and processing ai jobs older than 60 minutes keeping their step, and leaves a younger one and a done one', async () => {
    const { prisma } = database;
    const { id: userId } = await createUser(prisma);
    const old = new Date('2026-10-22T07:59:00.000Z');
    const young = new Date('2026-10-22T08:01:00.000Z');
    const queued = await createAiJob(prisma, { userId, status: 'queued', createdAt: old });
    const processing = await createAiJob(prisma, {
      userId,
      status: 'processing',
      step: 2,
      createdAt: old,
    });
    const waiting = await createAiJob(prisma, { userId, status: 'queued', createdAt: young });
    const done = await createAiJob(prisma, { userId, status: 'done', step: 3, createdAt: old });

    await expect(service.sweepStaleAiJobs()).resolves.toBe(2);

    const rows = await prisma.aiJob.findMany({
      select: { id: true, status: true, step: true, errorType: true, finishedAt: true },
    });
    const byId = new Map(rows.map(({ id, ...row }) => [id, row]));
    expect(byId.get(queued)).toEqual({
      status: 'failed',
      step: 0,
      errorType: 'ai_abandoned',
      finishedAt: NOW,
    });
    expect(byId.get(processing)).toEqual({
      status: 'failed',
      step: 2,
      errorType: 'ai_abandoned',
      finishedAt: NOW,
    });
    expect(byId.get(waiting)).toEqual({
      status: 'queued',
      step: 0,
      errorType: null,
      finishedAt: null,
    });
    expect(byId.get(done)).toEqual({ status: 'done', step: 3, errorType: null, finishedAt: null });
    expect(
      await Promise.all(
        [queued, processing, waiting].map((id) => storedFailureSettledAt(prisma, id)),
      ),
    ).toEqual([NOW, NOW, null]);
  });

  it("redelivers every user's unsettled ai failure finished within a day and up to five minutes ago, oldest first, and skips settled, done, too fresh and too old ones", async () => {
    const { prisma } = database;
    const [olena, bohdan] = [await createUser(prisma), await createUser(prisma)];
    const failed = (job: Omit<NewAiJob, 'status'>) =>
      createAiJob(prisma, { status: 'failed', errorType: 'ai_invalid_output', ...job });
    const atGrace = await failed({ userId: bohdan.id, finishedAt: minutesBefore(5) });
    const oldest = await failed({ userId: olena.id, finishedAt: minutesBefore(DAY_MINUTES - 1) });
    await failed({ userId: olena.id, finishedAt: minutesBefore(4) });
    await failed({ userId: olena.id, finishedAt: daysBefore(1) });
    await failed({ userId: olena.id, finishedAt: minutesBefore(30), failureSettledAt: NOW });
    await createAiJob(prisma, { userId: olena.id, status: 'done', finishedAt: minutesBefore(30) });

    await expect(service.redeliverUnsettledAiFailures()).resolves.toBe(2);

    expect(aiQueue.retried).toEqual([
      [oldest, 'failed'],
      [atGrace, 'failed'],
    ]);
  });
});
