import {
  applicationTimelineResponseSchema,
  errorResponseSchema,
  type TimelineItem,
  type TimelineRecord,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationPath,
  createApplication,
  postStageMove,
  ROMASHKA,
  stageEventsOf,
  timelinePath,
  undoLastMove,
} from '../../test/applications.js';
import { accessTokenFor, OLENA, signUp } from '../../test/auth.js';
import { createOwnedApplication, createStageEvents, createUser } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { APPLICATION_NOT_FOUND, MISSING_ID, TO_SCREENING } from '../../test/service-fixtures.js';
import { NOW, settableClock } from '../../test/time.js';
import { TimelineService } from './timeline.service.js';

type OwnApplication = { accessToken: string; id: string };

type DesignRecord = TimelineRecord & { occurredAt: Date };

const at = (instant: string) => new Date(`2026-${instant}.000Z`);

const DESIGN_NOTE = {
  body: 'Друга задача — динамічне програмування, здався на 20 хв. Треба повторити DP і графи. Команда норм, тимлід говорив по суті, стек без легасі.',
  createdAt: at('09-03T13:00:00'),
};

const DESIGN_STAGE_EVENTS = [
  { fromStage: null, toStage: 'applied', occurredAt: at('08-13T10:00:00') },
  { fromStage: 'applied', toStage: 'screening', occurredAt: at('08-21T10:00:00') },
  { fromStage: 'screening', toStage: 'tech_interview', occurredAt: at('08-28T10:00:00') },
] as const;

const DESIGN_RECORDS: DesignRecord[] = [
  { kind: 'captured', payload: { method: 'bookmarklet' }, occurredAt: at('08-12T09:00:00') },
  { kind: 'ai_parsed', payload: { durationSec: 6 }, occurredAt: at('08-12T09:00:06') },
  { kind: 'silence_started', payload: { silenceDays: 7 }, occurredAt: at('08-20T10:00:00') },
  { kind: 'followup_sent', payload: {}, occurredAt: at('08-27T18:00:00') },
  {
    kind: 'interview_done',
    payload: { kind: 'tech_interview', durationMin: 90 },
    occurredAt: at('09-03T12:30:00'),
  },
];

const DESIGN_TIMELINE: Omit<TimelineItem, 'id'>[] = [
  {
    type: 'note_added',
    occurredAt: '2026-09-03T13:00:00.000Z',
    title: 'Заметка',
    meta: { body: DESIGN_NOTE.body },
    actor: 'user',
  },
  {
    type: 'interview_done',
    occurredAt: '2026-09-03T12:30:00.000Z',
    title: "Техінтерв'ю пройдено · 90 хв",
    meta: { kind: 'tech_interview', durationMin: 90 },
    actor: 'user',
  },
  {
    type: 'stage_changed',
    occurredAt: '2026-08-28T10:00:00.000Z',
    title: "скринінг → техінтерв'ю",
    meta: {
      fromStage: 'screening',
      toStage: 'tech_interview',
      reasonCode: null,
      comment: null,
      daysInPreviousStage: 7,
    },
    actor: 'user',
  },
  {
    type: 'followup_sent',
    occurredAt: '2026-08-27T18:00:00.000Z',
    title: 'Фоллоу-ап надіслано',
    meta: {},
    actor: 'user',
  },
  {
    type: 'stage_changed',
    occurredAt: '2026-08-21T10:00:00.000Z',
    title: 'відгук → скринінг',
    meta: {
      fromStage: 'applied',
      toStage: 'screening',
      reasonCode: null,
      comment: null,
      daysInPreviousStage: 8,
    },
    actor: 'user',
  },
  {
    type: 'silence_started',
    occurredAt: '2026-08-20T10:00:00.000Z',
    title: '7 днів тиші · індикатор увімкнено',
    meta: { silenceDays: 7 },
    actor: 'system',
  },
  {
    type: 'stage_changed',
    occurredAt: '2026-08-13T10:00:00.000Z',
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
  {
    type: 'ai_parsed',
    occurredAt: '2026-08-12T09:00:06.000Z',
    title: 'AI розібрав опис за 6 секунд',
    meta: { durationSec: 6 },
    actor: 'system',
  },
  {
    type: 'captured',
    occurredAt: '2026-08-12T09:00:00.000Z',
    title: 'Карточку створено букмарклетом',
    meta: { method: 'bookmarklet' },
    actor: 'user',
  },
];

describe('the application timeline', () => {
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(Clock).useValue(settableClock(NOW)),
  );

  const timeline = () => testApp.app.get(TimelineService);

  const getTimeline = ({ accessToken, id }: OwnApplication) =>
    callRoute(testApp.app, { method: 'get', path: timelinePath(id), accessToken });

  const journalRowCount = (applicationId: string) =>
    testApp.prisma.timelineEvent.count({ where: { applicationId } });

  async function designApplication() {
    const { userId, applicationId } = await createOwnedApplication(testApp.prisma);
    await createStageEvents(
      testApp.prisma,
      DESIGN_STAGE_EVENTS.map((event) => ({ ...event, applicationId })),
    );
    await Promise.all(
      DESIGN_RECORDS.map((record) => timeline().record(userId, { ...record, applicationId })),
    );
    const note = await testApp.prisma.note.create({ data: { ...DESIGN_NOTE, applicationId } });
    await timeline().record(userId, {
      applicationId,
      kind: 'note_added',
      payload: { noteId: note.id },
      occurredAt: note.createdAt,
    });
    return {
      id: applicationId,
      noteId: note.id,
      accessToken: await accessTokenFor({ id: userId }),
    };
  }

  async function olenaWithApplication(): Promise<OwnApplication> {
    const { accessToken } = await signUp(testApp.app, OLENA);
    const { id } = await createApplication(testApp.app, { accessToken, input: ROMASHKA });
    return { accessToken, id };
  }

  it('returns the design example newest first in its wording, the note once from the notes table', async () => {
    const { noteId, ...application } = await designApplication();

    const response = await getTimeline(application);

    expect(response.status).toBe(200);
    const { items } = applicationTimelineResponseSchema.parse(response.body);
    expect(
      items.map(({ type, occurredAt, title, meta, actor }) => ({
        type,
        occurredAt,
        title,
        meta,
        actor,
      })),
    ).toEqual(DESIGN_TIMELINE);
    expect(items[0]?.id).toBe(noteId);
    expect(await journalRowCount(application.id)).toBe(6);
  });

  it('hides an undone move and the row that undid it, both kept in stage_events', async () => {
    const application = await olenaWithApplication();
    const { accessToken, id } = application;
    await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });
    await undoLastMove(testApp.app, { accessToken, id });

    const response = await getTimeline(application);

    expect(response.status).toBe(200);
    const { items } = applicationTimelineResponseSchema.parse(response.body);
    expect(items.map(({ title }) => title)).toEqual(['відгук надіслано']);
    expect(await stageEventsOf(testApp.prisma, id)).toHaveLength(3);
  });

  it('answers a soft-deleted application with 404', async () => {
    const application = await olenaWithApplication();
    const { accessToken, id } = application;
    const deleted = await callRoute(testApp.app, {
      method: 'delete',
      path: applicationPath(id),
      accessToken,
    });

    const response = await getTimeline(application);

    expect([deleted.status, response.status]).toEqual([204, 404]);
    expect(errorResponseSchema.parse(response.body).detail).toBe('Application not found');
  });

  it('answers no token with 401, a missing id with 404 and a malformed id with 422', async () => {
    const { accessToken } = await signUp(testApp.app, OLENA);

    const responses = await Promise.all([
      callRoute(testApp.app, { method: 'get', path: timelinePath(MISSING_ID) }),
      getTimeline({ accessToken, id: MISSING_ID }),
      getTimeline({ accessToken, id: 'not-a-uuid' }),
    ]);

    expect(
      responses.map(({ status, body }) => [status, errorResponseSchema.parse(body).type]),
    ).toEqual([
      [401, 'unauthorized'],
      [404, 'not_found'],
      [422, 'validation_error'],
    ]);
  });

  it("refuses BOHDAN's record on OLENA's application with 404 and writes no row", async () => {
    const olena = await createOwnedApplication(testApp.prisma);
    const bohdan = await createUser(testApp.prisma);

    await expect(
      timeline().record(bohdan.id, {
        applicationId: olena.applicationId,
        kind: 'followup_sent',
        payload: {},
        occurredAt: NOW,
      }),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect(await journalRowCount(olena.applicationId)).toBe(0);
  });

  it('leaves no row when the transaction the record joined rolls back', async () => {
    const { userId, applicationId } = await createOwnedApplication(testApp.prisma);

    const rolledBack = testApp.prisma.$transaction(async (tx) => {
      await timeline().record(userId, {
        applicationId,
        kind: 'followup_sent',
        payload: {},
        occurredAt: NOW,
        tx,
      });
      throw new Error('the caller failed after the record');
    });

    await expect(rolledBack).rejects.toThrow('the caller failed after the record');
    expect(await journalRowCount(applicationId)).toBe(0);
  });
});
