import type { SilenceWindow, Stage } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { SECOND_APPLICATION_ID } from '../../test/match.js';
import { RecordingNotifications } from '../../test/notifications.js';
import { APPLICATION_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { daysBefore, minutesBefore, NOW } from '../../test/time.js';
import { NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { RemindersService, type StartFollowup } from './reminders.service.js';
import {
  SilenceRepository,
  type SilenceWindows,
  type SilentApplicationRow,
} from './silence.repository.js';
import { SilenceScanService } from './silence-scan.service.js';

type Candidate = {
  stage: Stage;
  lastEventAt: Date;
  remindedAt?: Date;
  movedAt?: Date | undefined;
  id?: string;
  company?: string;
};

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

  readonly failures = new Map<string, Error>();

  startFollowup(userId: string, start: StartFollowup): Promise<void> {
    const failure = this.failures.get(start.applicationId);
    if (failure !== undefined) {
      return Promise.reject(failure);
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
  id = APPLICATION_ID,
  company = 'Ромашка',
}: Candidate): SilentApplicationRow => ({
  id,
  company,
  currentStage: stage,
  lastEventAt,
  reminders: remindedAt === undefined ? [] : [{ dueAt: remindedAt }],
  stageEvents: movedAt === undefined ? [] : [{ createdAt: movedAt }],
});

async function scanOf(candidates: Candidate | Candidate[], silenceDays = 7) {
  const repository = new FakeSilenceRepository();
  const followups = new RecordingFollowups();
  const notifications = new RecordingNotifications();
  repository.rows = [candidates].flat().map(candidateRow);
  const moduleRef = await Test.createTestingModule({
    providers: [
      SilenceScanService,
      { provide: SilenceRepository, useValue: repository },
      { provide: RemindersService, useValue: followups },
      { provide: NotificationsService, useValue: notifications },
      { provide: SettingsService, useValue: { get: () => Promise.resolve({ silenceDays }) } },
    ],
  }).compile();
  return { repository, followups, notifications, service: moduleRef.get(SilenceScanService) };
}

const THREE_SILENT: Candidate[] = [
  { stage: 'applied', lastEventAt: daysBefore(7), company: 'Ромашка' },
  { stage: 'applied', lastEventAt: daysBefore(9), company: 'Acme', id: MISSING_ID },
  { stage: 'final', lastEventAt: daysBefore(15), company: 'Globex', id: SECOND_APPLICATION_ID },
];

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
      { userId: OLENA_ID, applicationId: APPLICATION_ID, days: 3, now: NOW },
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

  it('counts a follow-up the unique index refuses as already started and writes no notification', async () => {
    const { followups, notifications, service } = await scanOf({
      stage: 'applied',
      lastEventAt: daysBefore(7),
    });
    followups.failures.set(APPLICATION_ID, uniqueViolation());

    await expect(service.startSilence(OLENA_ID, NOW)).resolves.toEqual({
      started: 0,
      alreadyStarted: 1,
    });
    expect(notifications.notifications).toEqual([]);
  });

  it('rethrows any other failure of the follow-up write and writes no notification', async () => {
    const { followups, notifications, service } = await scanOf({
      stage: 'applied',
      lastEventAt: daysBefore(7),
    });
    followups.failures.set(APPLICATION_ID, new Error('connection lost'));

    await expect(service.startSilence(OLENA_ID, NOW)).rejects.toThrow('connection lost');
    expect(notifications.notifications).toEqual([]);
  });
});

describe('SilenceScanService grouping the silence notification', () => {
  it('writes one silence notification with the one application that fell silent', async () => {
    const { notifications, service } = await scanOf(THREE_SILENT.slice(0, 1));

    await service.startSilence(OLENA_ID, NOW);

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'silence',
        payload: { items: [{ applicationId: APPLICATION_ID, company: 'Ромашка', days: 7 }] },
      },
    ]);
  });

  it('writes one silence notification listing the three applications that fell silent in one scan', async () => {
    const { notifications, service } = await scanOf(THREE_SILENT);

    await expect(service.startSilence(OLENA_ID, NOW)).resolves.toEqual({
      started: 3,
      alreadyStarted: 0,
    });

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'silence',
        payload: {
          items: [
            { applicationId: APPLICATION_ID, company: 'Ромашка', days: 7 },
            { applicationId: MISSING_ID, company: 'Acme', days: 9 },
            { applicationId: SECOND_APPLICATION_ID, company: 'Globex', days: 15 },
          ],
        },
      },
    ]);
  });

  it('writes no notification when nothing fell silent', async () => {
    const { notifications, service } = await scanOf({
      stage: 'applied',
      lastEventAt: daysBefore(6),
    });

    await service.startSilence(OLENA_ID, NOW);

    expect(notifications.notifications).toEqual([]);
  });

  it('leaves an application the unique index refuses out of the items', async () => {
    const { followups, notifications, service } = await scanOf(THREE_SILENT);
    followups.failures.set(MISSING_ID, uniqueViolation());

    await expect(service.startSilence(OLENA_ID, NOW)).resolves.toEqual({
      started: 2,
      alreadyStarted: 1,
    });

    expect(notifications.notifications.map(({ payload }) => payload)).toEqual([
      {
        items: [
          { applicationId: APPLICATION_ID, company: 'Ромашка', days: 7 },
          { applicationId: SECOND_APPLICATION_ID, company: 'Globex', days: 15 },
        ],
      },
    ]);
  });
});
