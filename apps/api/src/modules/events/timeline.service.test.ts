import { describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  CREATION_EVENT_ID,
  MISSING_TARGETS,
  MOVE_EVENT_ID,
  NOTE_ID,
  OLENA_ID,
  type Target,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import {
  type InsertTimelineEvent,
  type TimelineOfApplication,
  TimelineRepository,
  type TimelineRows,
} from './timeline.repository.js';
import { TimelineService } from './timeline.service.js';

const CAPTURED_ID = '0199f0a0-0000-7000-8000-0000000000f1';

const TIMELINE_ROWS: TimelineRows = {
  stageEvents: [
    {
      id: MOVE_EVENT_ID,
      fromStage: 'applied',
      toStage: 'screening',
      reasonCode: null,
      comment: 'Рекрутерка написала в LinkedIn',
      occurredAt: daysBefore(1),
    },
    {
      id: CREATION_EVENT_ID,
      fromStage: null,
      toStage: 'applied',
      reasonCode: null,
      comment: null,
      occurredAt: daysBefore(5),
    },
  ],
  timelineEvents: [
    { id: CAPTURED_ID, kind: 'captured', payload: { method: 'paste' }, occurredAt: daysBefore(5) },
  ],
  notes: [{ id: NOTE_ID, body: 'Спитати про on-call', createdAt: NOW }],
};

class FakeTimelineRepository {
  readonly inserted: ByUser<InsertTimelineEvent>[] = [];

  constructor(private readonly rows: TimelineRows) {}

  findTimeline(
    userId: string,
    { applicationId }: TimelineOfApplication,
  ): Promise<TimelineRows | null> {
    return Promise.resolve(this.owns({ userId, id: applicationId }) ? this.rows : null);
  }

  insert(userId: string, input: InsertTimelineEvent): Promise<number> {
    if (!this.owns({ userId, id: input.applicationId })) {
      return Promise.resolve(0);
    }
    this.inserted.push({ userId, ...input });
    return Promise.resolve(1);
  }

  private owns({ userId, id }: Target): boolean {
    return userId === OLENA_ID && id === APPLICATION_ID;
  }
}

async function serviceWith(rows: TimelineRows = TIMELINE_ROWS) {
  const repository = new FakeTimelineRepository(rows);
  const moduleRef = await fakeTransactionModule({
    providers: [TimelineService, TimelineRepository],
    now: NOW,
  })
    .overrideProvider(TimelineRepository)
    .useValue(repository)
    .compile();
  return {
    repository,
    service: moduleRef.get(TimelineService),
    prisma: moduleRef.get(PrismaService),
  };
}

describe('TimelineService.list', () => {
  it.each(MISSING_TARGETS)('answers $case with 404', async ({ userId, id }) => {
    const { service } = await serviceWith();

    await expect(service.list(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
  });

  it('merges stage events, journal rows and notes newest first, a tie broken by the higher id', async () => {
    const { service } = await serviceWith();

    expect(await service.list(OLENA_ID, APPLICATION_ID)).toEqual({
      items: [
        {
          id: NOTE_ID,
          type: 'note_added',
          occurredAt: '2026-10-22T09:00:00.000Z',
          title: 'Заметка',
          meta: { body: 'Спитати про on-call' },
          actor: 'user',
        },
        {
          id: MOVE_EVENT_ID,
          type: 'stage_changed',
          occurredAt: '2026-10-21T09:00:00.000Z',
          title: 'відгук → скринінг',
          meta: {
            fromStage: 'applied',
            toStage: 'screening',
            reasonCode: null,
            comment: 'Рекрутерка написала в LinkedIn',
            daysInPreviousStage: 4,
          },
          actor: 'user',
        },
        {
          id: CAPTURED_ID,
          type: 'captured',
          occurredAt: '2026-10-17T09:00:00.000Z',
          title: 'Карточку створено з тексту',
          meta: { method: 'paste' },
          actor: 'user',
        },
        {
          id: CREATION_EVENT_ID,
          type: 'stage_changed',
          occurredAt: '2026-10-17T09:00:00.000Z',
          title: 'відгук надіслано',
          meta: {
            fromStage: null,
            toStage: 'applied',
            reasonCode: null,
            comment: null,
            daysInPreviousStage: null,
          },
          actor: 'user',
        },
      ],
    });
  });

  it('marks the events the system writes with the system actor', async () => {
    const { service } = await serviceWith({
      stageEvents: [],
      notes: [],
      timelineEvents: [
        { id: CAPTURED_ID, kind: 'ai_parsed', payload: { durationSec: 2 }, occurredAt: NOW },
      ],
    });

    expect((await service.list(OLENA_ID, APPLICATION_ID)).items).toEqual([
      expect.objectContaining({ title: 'AI розібрав опис за 2 секунди', actor: 'system' }),
    ]);
  });

  it('refuses a journal row whose payload does not fit its kind', async () => {
    const { service } = await serviceWith({
      stageEvents: [],
      notes: [],
      timelineEvents: [{ id: CAPTURED_ID, kind: 'silence_started', payload: {}, occurredAt: NOW }],
    });

    await expect(service.list(OLENA_ID, APPLICATION_ID)).rejects.toThrow(/silenceDays/);
  });
});

describe('TimelineService.record', () => {
  it('writes the parsed record for the owner at the time the caller passes', async () => {
    const { repository, service } = await serviceWith();

    await service.record(OLENA_ID, {
      applicationId: APPLICATION_ID,
      kind: 'interview_done',
      payload: { kind: 'tech_interview', durationMin: 60 },
      occurredAt: daysBefore(2),
    });

    expect(repository.inserted).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        record: { kind: 'interview_done', payload: { kind: 'tech_interview', durationMin: 60 } },
        occurredAt: daysBefore(2),
      },
    ]);
  });

  it("writes inside the caller's transaction when the caller passes one", async () => {
    const { repository, service, prisma } = await serviceWith();

    await prisma.$transaction((tx) =>
      service.record(OLENA_ID, {
        applicationId: APPLICATION_ID,
        kind: 'followup_sent',
        payload: {},
        occurredAt: NOW,
        tx,
      }),
    );

    expect(repository.inserted).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        record: { kind: 'followup_sent', payload: {} },
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('refuses a payload that does not fit its kind and writes nothing', async () => {
    const { repository, service } = await serviceWith();

    await expect(
      service.record(OLENA_ID, {
        applicationId: APPLICATION_ID,
        kind: 'ai_parsed',
        payload: { durationSec: 0 },
        occurredAt: NOW,
      }),
    ).rejects.toThrow(/durationSec/);
    expect(repository.inserted).toEqual([]);
  });

  it.each(MISSING_TARGETS)('answers $case with 404', async ({ userId, id }) => {
    const { service } = await serviceWith();

    await expect(
      service.record(userId, {
        applicationId: id,
        kind: 'followup_sent',
        payload: {},
        occurredAt: NOW,
      }),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);
  });
});
