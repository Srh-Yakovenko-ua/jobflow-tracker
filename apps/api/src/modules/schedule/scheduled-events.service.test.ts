import type { CreateScheduledEventInput, ScheduledEventStatus } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, TimelineRecorder } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  MISSING_ID,
  MISSING_TARGETS,
  OLENA_ID,
  SCHEDULED_EVENT_ID,
  type Target,
} from '../../test/service-fixtures.js';
import { daysBefore, minutesAfter, NOW } from '../../test/time.js';
import { TimelineService } from '../events/index.js';
import {
  type CloseInterviewReminder,
  type PlanInterview,
  RemindersService,
} from '../reminders/index.js';
import { ScheduledEventEffects } from './scheduled-event-effects.js';
import {
  type FindScheduledEvent,
  type InsertScheduledEvent,
  type OwnedScheduledEventRow,
  type ScheduledEventOfApplication,
  scheduledEventPatch,
  type ScheduledEventRow,
  ScheduledEventsRepository,
  type UpdateScheduledEvent,
} from './scheduled-events.repository.js';
import { ScheduledEventsService } from './scheduled-events.service.js';

type ReminderCall = ByUser<{ method: string; scheduledEventId: string; detail: unknown }>;

const NOW_ISO = '2026-10-22T09:00:00.000Z';

const INPUT: CreateScheduledEventInput = {
  kind: 'tech_interview',
  startsAt: '2026-10-22T15:00:00+03:00',
  durationMin: 90,
};

const EVENT = { applicationId: APPLICATION_ID, eventId: SCHEDULED_EVENT_ID };

const SCHEDULED_EVENT_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Scheduled event not found' },
};

const CONFLICT = { body: { status: 409, type: 'conflict' } };

const ACME = { company: 'Acme', currentStage: 'tech_interview' } as const;

function storedEvent(status: ScheduledEventStatus): ScheduledEventRow {
  return {
    id: SCHEDULED_EVENT_ID,
    applicationId: APPLICATION_ID,
    kind: 'tech_interview',
    startsAt: minutesAfter(-180),
    durationMin: 90,
    locationOrLink: 'https://meet.example.test/abc',
    status,
    outcomeNote: null,
    createdAt: daysBefore(1),
    updatedAt: daysBefore(1),
  };
}

class FakeScheduledEventsRepository {
  readonly inserted: ByUser<InsertScheduledEvent>[] = [];
  statusChangedMeanwhile: ScheduledEventStatus | undefined;

  constructor(private stored: ScheduledEventRow) {}

  insert(userId: string, insert: InsertScheduledEvent): Promise<ScheduledEventRow | null> {
    if (!this.ownsApplication({ userId, id: insert.applicationId })) {
      return Promise.resolve(null);
    }
    this.inserted.push({ userId, ...insert });
    const startsAt = new Date(insert.input.startsAt);
    return Promise.resolve({ ...this.stored, startsAt, status: 'planned' });
  }

  findOwned(userId: string, target: FindScheduledEvent): Promise<OwnedScheduledEventRow | null> {
    const owns = this.ownsEvent(userId, target);
    return Promise.resolve(owns ? { ...this.stored, application: ACME } : null);
  }

  updateOwned(userId: string, update: UpdateScheduledEvent): Promise<number> {
    const { input, expectedStatus, updatedAt, ...target } = update;
    const status = this.statusChangedMeanwhile ?? this.stored.status;
    if (!this.ownsEvent(userId, target) || status !== expectedStatus) {
      return Promise.resolve(0);
    }
    this.stored = { ...this.stored, ...scheduledEventPatch(input), updatedAt };
    return Promise.resolve(1);
  }

  deleteOwned(userId: string, target: ScheduledEventOfApplication): Promise<number> {
    return Promise.resolve(this.ownsEvent(userId, target) ? 1 : 0);
  }

  private ownsApplication({ userId, id }: Target): boolean {
    return userId === OLENA_ID && id === APPLICATION_ID;
  }

  private ownsEvent(userId: string, { applicationId, eventId }: ScheduledEventOfApplication) {
    return this.ownsApplication({ userId, id: applicationId }) && eventId === this.stored.id;
  }
}

class RemindersRecorder {
  readonly calls: ReminderCall[] = [];

  planInterview(userId: string, { scheduledEventId, startsAt, now }: PlanInterview) {
    this.calls.push({ userId, method: 'plan', scheduledEventId, detail: { startsAt, now } });
    return Promise.resolve();
  }

  closeInterview(userId: string, { scheduledEventId, status }: CloseInterviewReminder) {
    this.calls.push({ userId, method: 'close', scheduledEventId, detail: status });
    return Promise.resolve();
  }
}

async function serviceWithFakes(status: ScheduledEventStatus = 'planned') {
  const repository = new FakeScheduledEventsRepository(storedEvent(status));
  const timeline = new TimelineRecorder();
  const reminders = new RemindersRecorder();
  const moduleRef = await fakeTransactionModule({
    providers: [
      ScheduledEventsService,
      ScheduledEventsRepository,
      ScheduledEventEffects,
      TimelineService,
      RemindersService,
    ],
    now: NOW,
  })
    .overrideProvider(ScheduledEventsRepository)
    .useValue(repository)
    .overrideProvider(TimelineService)
    .useValue(timeline)
    .overrideProvider(RemindersService)
    .useValue(reminders)
    .compile();
  return { repository, timeline, reminders, service: moduleRef.get(ScheduledEventsService) };
}

const kindsOf = ({ events }: TimelineRecorder) => events.map(({ kind }) => kind);

describe('ScheduledEventsService.create', () => {
  it('stores the event in UTC, records interview_scheduled and arms its reminder in one transaction', async () => {
    const { timeline, reminders, service } = await serviceWithFakes();

    const event = await service.create(OLENA_ID, { applicationId: APPLICATION_ID, input: INPUT });

    expect(event).toMatchObject({ startsAt: '2026-10-22T12:00:00.000Z', status: 'planned' });
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'interview_scheduled',
        payload: { kind: 'tech_interview', startsAt: '2026-10-22T12:00:00.000Z' },
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(reminders.calls).toEqual([
      {
        userId: OLENA_ID,
        method: 'plan',
        scheduledEventId: SCHEDULED_EVENT_ID,
        detail: { startsAt: new Date('2026-10-22T12:00:00.000Z'), now: NOW },
      },
    ]);
  });

  it.each(MISSING_TARGETS)('answers $case with 404 and writes nothing', async (target) => {
    const { repository, timeline, reminders, service } = await serviceWithFakes();

    await expect(
      service.create(target.userId, { applicationId: target.id, input: INPUT }),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect([repository.inserted, timeline.events, reminders.calls]).toEqual([[], [], []]);
  });
});

describe('ScheduledEventsService.update', () => {
  it('marks a planned tech interview done: one interview_done at its end, the reminder done and final suggested', async () => {
    const { timeline, reminders, service } = await serviceWithFakes();

    const updated = await service.update(OLENA_ID, { ...EVENT, input: { status: 'done' } });

    expect(updated).toMatchObject({ status: 'done', updatedAt: NOW_ISO, suggestedStage: 'final' });
    expect(timeline.events).toMatchObject([
      {
        kind: 'interview_done',
        payload: { kind: 'tech_interview', durationMin: 90 },
        occurredAt: new Date('2026-10-22T07:30:00.000Z'),
      },
    ]);
    expect(reminders.calls).toMatchObject([{ method: 'close', detail: 'done' }]);
  });

  it('cancels a planned event: the reminder is dismissed, nothing goes to the timeline', async () => {
    const { timeline, reminders, service } = await serviceWithFakes();

    const updated = await service.update(OLENA_ID, { ...EVENT, input: { status: 'cancelled' } });

    expect(updated.suggestedStage).toBeNull();
    expect(timeline.events).toEqual([]);
    expect(reminders.calls).toMatchObject([{ method: 'close', detail: 'dismissed' }]);
  });

  it('arms the reminder again for a new start of a planned event', async () => {
    const { timeline, reminders, service } = await serviceWithFakes();

    await service.update(OLENA_ID, { ...EVENT, input: { startsAt: '2026-10-23T10:00:00Z' } });

    expect(timeline.events).toEqual([]);
    expect(reminders.calls).toMatchObject([
      { method: 'plan', detail: { startsAt: new Date('2026-10-23T10:00:00Z'), now: NOW } },
    ]);
  });

  it.each([
    { from: 'done', to: 'planned' },
    { from: 'done', to: 'cancelled' },
    { from: 'cancelled', to: 'done' },
  ] as const)('answers $from -> $to with 409 and writes nothing', async ({ from, to }) => {
    const { timeline, reminders, service } = await serviceWithFakes(from);

    await expect(
      service.update(OLENA_ID, { ...EVENT, input: { status: to } }),
    ).rejects.toMatchObject(CONFLICT);
    expect([timeline.events, reminders.calls]).toEqual([[], []]);
  });

  it('answers 409 when another request marked the event done after it was read', async () => {
    const { repository, timeline, service } = await serviceWithFakes();
    repository.statusChangedMeanwhile = 'done';

    await expect(
      service.update(OLENA_ID, { ...EVENT, input: { status: 'done' } }),
    ).rejects.toMatchObject(CONFLICT);
    expect(timeline.events).toEqual([]);
  });

  it('treats done -> done as a no-op that records nothing and suggests nothing', async () => {
    const { timeline, reminders, service } = await serviceWithFakes('done');

    const updated = await service.update(OLENA_ID, {
      ...EVENT,
      input: { status: 'done', outcomeNote: 'Пройшло добре' },
    });

    expect(updated).toMatchObject({ outcomeNote: 'Пройшло добре', suggestedStage: null });
    expect([timeline.events, reminders.calls]).toEqual([[], []]);
  });

  it('answers a missing event with 404 Scheduled event not found', async () => {
    const { service } = await serviceWithFakes();

    await expect(
      service.update(OLENA_ID, { ...EVENT, eventId: MISSING_ID, input: { status: 'done' } }),
    ).rejects.toMatchObject(SCHEDULED_EVENT_NOT_FOUND);
  });
});

describe('ScheduledEventsService.remove and ics', () => {
  it('answers a missing event with 404 on both', async () => {
    const { service } = await serviceWithFakes();
    const missing = { ...EVENT, eventId: MISSING_ID };

    await expect(service.remove(OLENA_ID, missing)).rejects.toMatchObject(
      SCHEDULED_EVENT_NOT_FOUND,
    );
    await expect(service.ics(OLENA_ID, missing)).rejects.toMatchObject(SCHEDULED_EVENT_NOT_FOUND);
  });

  it('exports the event with its company as the summary, stamped now', async () => {
    const { service } = await serviceWithFakes();

    const ics = await service.ics(OLENA_ID, EVENT);

    expect(ics).toContain("\r\nSUMMARY:Техінтерв'ю · Acme\r\n");
    expect(ics).toContain('\r\nDTSTAMP:20261022T090000Z\r\n');
  });
});

describe('ScheduledEventsService on timeline kinds', () => {
  it('writes interview_done only on the change that made the event done', async () => {
    const { timeline, service } = await serviceWithFakes();

    await service.update(OLENA_ID, { ...EVENT, input: { status: 'done' } });
    await service.update(OLENA_ID, { ...EVENT, input: { status: 'done' } });

    expect(kindsOf(timeline)).toEqual(['interview_done']);
  });
});
