import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { InterviewAlertsService, SilenceScanService } from '../modules/reminders/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { useTestDatabase } from '../test/database.js';
import { createActiveVersionOwner, createSearch, createUser } from '../test/factories.js';
import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { daysBefore, fixedClock, NOW } from '../test/time.js';
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
      { provide: SilenceScanService, useValue: {} },
      { provide: InterviewAlertsService, useValue: {} },
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
    await prisma.notification.create({
      data: {
        userId: bohdan.id,
        type: 'insight_unlocked',
        createdAt: atOffset(BOUNDARIES.notification, JUST_OUTSIDE),
      },
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
    const kept = await prisma.notification.findMany({
      orderBy: { type: 'asc' },
      select: { type: true, createdAt: true },
    });
    expect(kept).toEqual([
      { type: 'silence', createdAt: new Date(BOUNDARIES.notification) },
      { type: 'insight_unlocked', createdAt: atOffset(BOUNDARIES.notification, JUST_OUTSIDE) },
    ]);
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

  it('lists only users with an active search as week close candidates', async () => {
    const { prisma } = database;
    const searching = await createUser(prisma);
    const archived = await createUser(prisma);
    await createUser(prisma);
    await createSearch(prisma, { userId: searching.id });
    await createSearch(prisma, { userId: archived.id, status: 'archived' });

    await expect(repository.weekCloseCandidates()).resolves.toEqual([
      { userId: searching.id, timezone: 'Europe/Kyiv' },
    ]);
  });

  it("lists as ghost candidates only the user's own live active cards silent up to the cutoff, oldest first", async () => {
    const { prisma } = database;
    const cutoff = daysBefore(30);
    const olena = await createActiveVersionOwner(prisma, [
      { company: 'At cutoff', currentStage: 'final', lastEventAt: cutoff },
      { company: 'Older', lastEventAt: daysBefore(45) },
      { company: 'Younger', lastEventAt: daysBefore(29) },
      { company: 'Draft', isDraft: true, lastEventAt: daysBefore(45) },
      { company: 'Deleted', deletedAt: NOW, lastEventAt: daysBefore(45) },
      { company: 'Rejected', currentStage: 'rejected', lastEventAt: daysBefore(45) },
    ]);
    await createActiveVersionOwner(prisma, [{ company: 'Bohdan', lastEventAt: daysBefore(45) }]);

    const rows = await repository.ghostCandidates(olena.userId, cutoff);

    expect(rows.map(({ company, currentStage }) => [company, currentStage])).toEqual([
      ['Older', 'applied'],
      ['At cutoff', 'final'],
    ]);
  });

  it('lists as auto ghost candidates only users with the setting on and a live active card', async () => {
    const { prisma } = database;
    const watched = await createActiveVersionOwner(prisma, [{ lastEventAt: daysBefore(45) }]);
    const off = await createActiveVersionOwner(prisma, [{ lastEventAt: daysBefore(45) }]);
    await prisma.userSettings.update({
      where: { userId: off.userId },
      data: { autoGhostDays: null },
    });
    await createActiveVersionOwner(prisma, [
      { currentStage: 'ghosted', lastEventAt: daysBefore(45) },
    ]);

    await expect(repository.autoGhostCandidates()).resolves.toEqual([
      { userId: watched.userId, autoGhostDays: 30 },
    ]);
  });
});
