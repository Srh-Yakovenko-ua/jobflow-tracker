import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { conflict, illegalTransition, notFound } from '../common/app-error.js';
import { Clock } from '../common/clock.js';
import { type StageMove, StageTransitionService } from '../modules/applications/index.js';
import { NotificationsService } from '../modules/notifications/index.js';
import { SECOND_APPLICATION_ID } from '../test/match.js';
import { memoryLog } from '../test/memory-log.js';
import { RecordingNotifications } from '../test/notifications.js';
import { compileProcessorModule } from '../test/processor.js';
import { APPLICATION_ID, BOHDAN_ID, MISSING_ID, OLENA_ID } from '../test/service-fixtures.js';
import { daysBefore, NOW } from '../test/time.js';
import { AutoGhostScanService } from './auto-ghost-scan.service.js';
import {
  type AutoGhostCandidate,
  type GhostCandidate,
  ScheduledJobsRepository,
} from './scheduled-jobs.repository.js';

const log = memoryLog();

class FakeGhostRepository {
  candidates: AutoGhostCandidate[] = [];

  readonly rowsOf = new Map<string, GhostCandidate[]>();

  readonly cutoffs: { userId: string; cutoff: Date }[] = [];

  autoGhostCandidates(): Promise<AutoGhostCandidate[]> {
    return Promise.resolve(this.candidates);
  }

  ghostCandidates(userId: string, cutoff: Date): Promise<GhostCandidate[]> {
    this.cutoffs.push({ userId, cutoff });
    return Promise.resolve(this.rowsOf.get(userId) ?? []);
  }
}

class RecordingStageMoves {
  readonly moves: (StageMove & { userId: string })[] = [];

  readonly failures = new Map<string, Error>();

  move(userId: string, move: StageMove): Promise<unknown> {
    const failure = this.failures.get(move.id);
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    this.moves.push({ userId, ...move });
    return Promise.resolve({});
  }
}

const ghostMove = (userId: string, row: Pick<GhostCandidate, 'id' | 'currentStage'>) => ({
  userId,
  id: row.id,
  input: { fromStage: row.currentStage, toStage: 'ghosted', reasonCode: 'silence_timeout' },
});

const ROMASHKA: GhostCandidate = {
  id: APPLICATION_ID,
  company: 'Ромашка',
  currentStage: 'applied',
  lastEventAt: daysBefore(40),
};

const ACME: GhostCandidate = {
  id: MISSING_ID,
  company: 'Acme',
  currentStage: 'final',
  lastEventAt: daysBefore(30),
};

const GLOBEX: GhostCandidate = {
  id: SECOND_APPLICATION_ID,
  company: 'Globex',
  currentStage: 'screening',
  lastEventAt: daysBefore(14),
};

const ONLY_ROMASHKA_NOTIFIED = [
  {
    userId: OLENA_ID,
    type: 'auto_ghosted',
    payload: {
      items: [{ applicationId: APPLICATION_ID, company: 'Ромашка', days: 40 }],
      autoGhostDays: 30,
    },
  },
];

describe('AutoGhostScanService', () => {
  const repository = new FakeGhostRepository();
  const moves = new RecordingStageMoves();
  const notifications = new RecordingNotifications();
  let service: AutoGhostScanService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      AutoGhostScanService,
      { provide: ScheduledJobsRepository, useValue: repository },
      { provide: Clock, useValue: { now: () => NOW } },
      { provide: StageTransitionService, useValue: moves },
      { provide: NotificationsService, useValue: notifications },
    ]);
    service = moduleRef.get(AutoGhostScanService);
    close = () => moduleRef.close();
  });

  beforeEach(() => {
    log.lines.length = 0;
    repository.cutoffs.length = 0;
    repository.candidates = [
      { userId: OLENA_ID, autoGhostDays: 30 },
      { userId: BOHDAN_ID, autoGhostDays: 14 },
    ];
    repository.rowsOf.set(OLENA_ID, [ROMASHKA, ACME]);
    repository.rowsOf.set(BOHDAN_ID, [GLOBEX]);
    moves.moves.length = 0;
    moves.failures.clear();
    notifications.notifications.length = 0;
  });

  afterAll(async () => {
    await close();
  });

  it('moves every silent card of each user to ghosted with silence_timeout, cut at that user’s own days', async () => {
    await expect(service.scan()).resolves.toEqual({ users: 2, moved: 3, skipped: 0 });

    expect(repository.cutoffs).toEqual([
      { userId: OLENA_ID, cutoff: new Date('2026-09-22T09:00:00.000Z') },
      { userId: BOHDAN_ID, cutoff: new Date('2026-10-08T09:00:00.000Z') },
    ]);
    expect(moves.moves).toEqual([
      ghostMove(OLENA_ID, ROMASHKA),
      ghostMove(OLENA_ID, ACME),
      ghostMove(BOHDAN_ID, GLOBEX),
    ]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ users: 2, moved: 3, skipped: 0, msg: 'auto ghost scan done' }),
    ]);
  });

  it('notifies each user once with the moved companies, their silent days and the setting', async () => {
    await service.scan();

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'auto_ghosted',
        payload: {
          items: [
            { applicationId: APPLICATION_ID, company: 'Ромашка', days: 40 },
            { applicationId: MISSING_ID, company: 'Acme', days: 30 },
          ],
          autoGhostDays: 30,
        },
      },
      {
        userId: BOHDAN_ID,
        type: 'auto_ghosted',
        payload: {
          items: [{ applicationId: SECOND_APPLICATION_ID, company: 'Globex', days: 14 }],
          autoGhostDays: 14,
        },
      },
    ]);
  });

  it('skips a card the user moved or deleted meanwhile and leaves it out of the notification', async () => {
    moves.failures.set(ACME.id, illegalTransition('applied -> ghosted'));
    moves.failures.set(GLOBEX.id, notFound());

    await expect(service.scan()).resolves.toEqual({ users: 2, moved: 1, skipped: 2 });

    expect(notifications.notifications).toEqual(ONLY_ROMASHKA_NOTIFIED);
  });

  it('counts a stale fromStage conflict as skipped', async () => {
    moves.failures.set(ROMASHKA.id, conflict());

    await expect(service.scan()).resolves.toEqual({ users: 2, moved: 2, skipped: 1 });
  });

  it('rethrows any other failure after notifying the cards already moved', async () => {
    const failure = new Error('database refused');
    moves.failures.set(ACME.id, failure);

    await expect(service.scan()).rejects.toBe(failure);

    expect(moves.moves).toEqual([ghostMove(OLENA_ID, ROMASHKA)]);
    expect(notifications.notifications).toEqual(ONLY_ROMASHKA_NOTIFIED);
  });
});
