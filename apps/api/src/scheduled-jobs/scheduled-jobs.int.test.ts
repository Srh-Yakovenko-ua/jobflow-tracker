import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { useTestDatabase } from '../test/database.js';
import { createAiJob, createUser } from '../test/factories.js';
import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { fixedClock, NOW } from '../test/time.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

const log = memoryLog();

const JUST_OUTSIDE = -1;

const atOffset = (iso: string, offsetMs: number) => new Date(new Date(iso).getTime() + offsetMs);

const BOUNDARIES = {
  idempotencyKey: '2026-10-21T09:00:00.000Z',
  refreshToken: '2026-10-22T09:00:00.000Z',
  notification: '2026-07-24T09:00:00.000Z',
} as const;

describe('ScheduledJobsService on the database', () => {
  const database = useTestDatabase();
  let service: ScheduledJobsService;
  let repository: ScheduledJobsRepository;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      ScheduledJobsService,
      ScheduledJobsRepository,
      { provide: PrismaService, useValue: database.prisma },
      { provide: Clock, useValue: fixedClock(NOW) },
    ]);
    service = moduleRef.get(ScheduledJobsService);
    repository = moduleRef.get(ScheduledJobsRepository);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it("deletes every user's rows just outside each cleanup window and keeps the ones at its edge", async () => {
    const { prisma } = database;
    const [olena, bohdan] = [await createUser(prisma), await createUser(prisma)];
    await prisma.idempotencyKey.createMany({
      data: [
        {
          userId: olena.id,
          key: 'kept',
          requestHash: 'h',
          createdAt: new Date(BOUNDARIES.idempotencyKey),
        },
        {
          userId: bohdan.id,
          key: 'old',
          requestHash: 'h',
          createdAt: atOffset(BOUNDARIES.idempotencyKey, JUST_OUTSIDE),
        },
      ],
    });
    await prisma.refreshToken.createMany({
      data: [
        new Date(BOUNDARIES.refreshToken),
        atOffset(BOUNDARIES.refreshToken, JUST_OUTSIDE),
      ].map((expiresAt) => ({
        userId: olena.id,
        tokenHash: randomUUID(),
        familyId: randomUUID(),
        expiresAt,
      })),
    });
    await prisma.notification.createMany({
      data: [
        new Date(BOUNDARIES.notification),
        atOffset(BOUNDARIES.notification, JUST_OUTSIDE),
      ].map((createdAt) => ({ userId: bohdan.id, type: 'silence' as const, createdAt })),
    });

    await expect(service.cleanup()).resolves.toEqual({
      idempotencyKeys: 1,
      refreshTokens: 1,
      notifications: 1,
    });

    expect(await prisma.idempotencyKey.findMany({ select: { key: true } })).toEqual([
      { key: 'kept' },
    ]);
    expect(await prisma.refreshToken.findMany({ select: { expiresAt: true } })).toEqual([
      { expiresAt: new Date(BOUNDARIES.refreshToken) },
    ]);
    expect(await prisma.notification.findMany({ select: { createdAt: true } })).toEqual([
      { createdAt: new Date(BOUNDARIES.notification) },
    ]);
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
  });

  it('lists only users with the monthly summary on as monthly summary candidates', async () => {
    const { prisma } = database;
    const subscribed = await createUser(prisma);
    await createUser(prisma, {
      settings: { create: { monthlySummaryEnabled: false, timezone: 'UTC' } },
    });

    await expect(repository.monthlySummaryCandidates()).resolves.toEqual([
      { userId: subscribed.id, timezone: 'Europe/Kyiv' },
    ]);
  });
});
