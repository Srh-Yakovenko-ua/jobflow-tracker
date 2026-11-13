import type { SilenceWindow, Stage } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { daysBefore, minutesBefore, NOW } from '../../test/time.js';
import { SettingsService } from '../settings/index.js';
import { RemindersService, type StartFollowup } from './reminders.service.js';
import {
  SilenceRepository,
  type SilenceWindows,
  type SilentApplicationRow,
} from './silence.repository.js';
import { SilenceScanService } from './silence-scan.service.js';

type Candidate = { stage: Stage; lastEventAt: Date; remindedAt?: Date; movedAt?: Date | undefined };

const DAY_MINUTES = 24 * 60;

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });

const inWindow = (row: SilentApplicationRow) => (window: SilenceWindow) =>
  window.stages.includes(row.currentStage) &&
  (window.lastEventAtOrBefore === undefined || row.lastEventAt <= window.lastEventAtOrBefore);

class FakeSilenceRepository {
  rows: SilentApplicationRow[] = [];

  readonly readFor: string[] = [];

  findSilentApplications(userId: string, { windows }: SilenceWindows) {
    this.readFor.push(userId);
    return Promise.resolve(this.rows.filter((row) => windows.some(inWindow(row))));
  }
}

class RecordingFollowups {
  readonly started: (StartFollowup & { userId: string })[] = [];

  failure: Error | undefined;

  startFollowup(userId: string, start: StartFollowup): Promise<void> {
    if (this.failure !== undefined) {
      return Promise.reject(this.failure);
    }
    this.started.push({ userId, ...start });
    return Promise.resolve();
  }
}

const candidateRow = ({
  stage,
  lastEventAt,
  remindedAt,
  movedAt,
}: Candidate): SilentApplicationRow => ({
  id: APPLICATION_ID,
  company: 'Ромашка',
  currentStage: stage,
  lastEventAt,
  reminders: remindedAt === undefined ? [] : [{ dueAt: remindedAt }],
  stageEvents: movedAt === undefined ? [] : [{ createdAt: movedAt }],
});

async function scanOf(candidate: Candidate, silenceDays = 7) {
  const repository = new FakeSilenceRepository();
  const followups = new RecordingFollowups();
  repository.rows = [candidateRow(candidate)];
  const moduleRef = await Test.createTestingModule({
    providers: [SilenceScanService, SilenceRepository, RemindersService, SettingsService],
  })
    .overrideProvider(SilenceRepository)
    .useValue(repository)
    .overrideProvider(RemindersService)
    .useValue(followups)
    .overrideProvider(SettingsService)
    .useValue({ get: () => Promise.resolve({ silenceDays }) })
    .compile();
  return { repository, followups, service: moduleRef.get(SilenceScanService) };
}

describe('SilenceScanService.startSilence', () => {
  it.each([
    { stage: 'applied', minutes: 7 * DAY_MINUTES, started: 1 },
    { stage: 'applied', minutes: 7 * DAY_MINUTES - 1, started: 0 },
    { stage: 'tech_interview', minutes: 7 * DAY_MINUTES, started: 1 },
    { stage: 'final', minutes: 7 * DAY_MINUTES, started: 0 },
    { stage: 'final', minutes: 14 * DAY_MINUTES - 1, started: 0 },
    { stage: 'final', minutes: 14 * DAY_MINUTES, started: 1 },
    { stage: 'offer', minutes: 30 * DAY_MINUTES, started: 0 },
  ] as const)(
    'starts $started follow-ups for $stage silent $minutes minutes with silenceDays 7',
    async ({ stage, minutes, started }) => {
      const { service } = await scanOf({ stage, lastEventAt: minutesBefore(minutes) });

      await expect(service.startSilence(OLENA_ID, NOW)).resolves.toEqual({
        started,
        alreadyStarted: 0,
      });
    },
  );

  it('reads the threshold from the settings of the user', async () => {
    const { repository, followups, service } = await scanOf(
      { stage: 'applied', lastEventAt: daysBefore(3) },
      3,
    );

    await service.startSilence(OLENA_ID, NOW);

    expect(repository.readFor).toEqual([OLENA_ID]);
    expect(followups.started).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        company: 'Ромашка',
        lastEventAt: daysBefore(3),
        now: NOW,
      },
    ]);
  });

  it.each([
    { case: 'a follow-up due at the last event', remindedAt: daysBefore(8), started: 0 },
    { case: 'a follow-up due after the last event', remindedAt: daysBefore(1), started: 0 },
    { case: 'only a follow-up of an earlier silence', remindedAt: daysBefore(9), started: 1 },
    {
      case: 'a follow-up before a move logged later but dated earlier',
      remindedAt: daysBefore(6),
      movedAt: daysBefore(3),
      started: 1,
    },
    {
      case: 'a follow-up before an undo that restored an older last event',
      remindedAt: daysBefore(2),
      movedAt: daysBefore(1),
      started: 1,
    },
    {
      case: 'a follow-up after the move that set the last event',
      remindedAt: daysBefore(1),
      movedAt: daysBefore(8),
      started: 0,
    },
  ])(
    'starts $started follow-ups for an application with $case',
    async ({ remindedAt, movedAt, started }) => {
      const { followups, service } = await scanOf({
        stage: 'applied',
        lastEventAt: daysBefore(8),
        remindedAt,
        movedAt,
      });

      await service.startSilence(OLENA_ID, NOW);

      expect(followups.started).toHaveLength(started);
    },
  );

  it('counts a follow-up the unique index refuses as already started', async () => {
    const { followups, service } = await scanOf({ stage: 'applied', lastEventAt: daysBefore(7) });
    followups.failure = uniqueViolation();

    await expect(service.startSilence(OLENA_ID, NOW)).resolves.toEqual({
      started: 0,
      alreadyStarted: 1,
    });
  });

  it('rethrows any other failure of the follow-up write', async () => {
    const { followups, service } = await scanOf({ stage: 'applied', lastEventAt: daysBefore(7) });
    followups.failure = new Error('connection lost');

    await expect(service.startSilence(OLENA_ID, NOW)).rejects.toThrow('connection lost');
  });
});
