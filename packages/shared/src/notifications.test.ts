import { describe, expect, it } from 'vitest';

import {
  type AiDoneNotificationPayload,
  aiDoneNotificationPayloadSchema,
  type InterviewSoonNotificationPayload,
  interviewSoonNotificationPayloadSchema,
  markNotificationsReadInputSchema,
  markNotificationsReadResponseSchema,
  type Notification,
  notificationListQuerySchema,
  notificationSchema,
  type SilenceItem,
  type SilenceNotificationPayload,
  silenceNotificationPayloadSchema,
} from './notifications.js';
import { issuePathsOf } from './test/zod-issues.js';

const APPLICATION_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f';
const NOTIFICATION_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e21';

const SILENCE_ITEM: SilenceItem = { applicationId: APPLICATION_ID, company: 'Acme', days: 4 };

const SILENCE: SilenceNotificationPayload = { items: [SILENCE_ITEM] };

const INTERVIEW_SOON: InterviewSoonNotificationPayload = {
  applicationId: APPLICATION_ID,
  scheduledEventId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e20',
  company: 'Acme',
  startsAt: '2026-11-03T14:00:00.000Z',
  minutesBefore: 120,
};

const AI_DONE: AiDoneNotificationPayload = {
  aiJobId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e22',
  kind: 'vacancy_parse',
  applicationId: APPLICATION_ID,
};

const ROW = { id: NOTIFICATION_ID, readAt: null, createdAt: '2026-11-13T09:00:00.000Z' };

describe('notification payloads', () => {
  it('keeps a silence payload as sent', () => {
    expect(silenceNotificationPayloadSchema.parse(SILENCE)).toStrictEqual(SILENCE);
  });

  it('keeps a grouped silence payload of three cards as one', () => {
    const grouped = { items: [SILENCE_ITEM, { ...SILENCE_ITEM, days: 9 }, SILENCE_ITEM] };
    expect(silenceNotificationPayloadSchema.parse(grouped)).toStrictEqual(grouped);
  });

  it('refuses a silence payload without cards', () => {
    expect(issuePathsOf(silenceNotificationPayloadSchema.safeParse({ items: [] }))).toEqual([
      'items',
    ]);
  });

  it('keeps an interview soon payload as sent', () => {
    expect(interviewSoonNotificationPayloadSchema.parse(INTERVIEW_SOON)).toStrictEqual(
      INTERVIEW_SOON,
    );
  });

  it('refuses a silence payload with a fractional day count', () => {
    const fractional = { items: [{ ...SILENCE_ITEM, days: 4.5 }] };
    expect(issuePathsOf(silenceNotificationPayloadSchema.safeParse(fractional))).toEqual([
      'items.0.days',
    ]);
  });

  it('refuses an interview soon payload without a lead time', () => {
    const withoutLead = { ...INTERVIEW_SOON, minutesBefore: undefined };
    expect(issuePathsOf(interviewSoonNotificationPayloadSchema.safeParse(withoutLead))).toEqual([
      'minutesBefore',
    ]);
  });

  it('keeps an AI done payload for a followup draft', () => {
    const followup = { ...AI_DONE, kind: 'followup' };
    expect(aiDoneNotificationPayloadSchema.parse(followup)).toStrictEqual(followup);
  });

  it('refuses an AI done payload for the match kind', () => {
    expect(
      issuePathsOf(aiDoneNotificationPayloadSchema.safeParse({ ...AI_DONE, kind: 'match' })),
    ).toEqual(['kind']);
  });
});

describe('notificationSchema', () => {
  it.each<[string, Notification]>([
    ['a grouped silence', { ...ROW, type: 'silence', payload: SILENCE }],
    ['an interview soon', { ...ROW, type: 'interview_soon', payload: INTERVIEW_SOON }],
    ['an AI done', { ...ROW, type: 'ai_done', payload: AI_DONE }],
    [
      'an AI failed',
      {
        ...ROW,
        type: 'ai_failed',
        payload: { ...AI_DONE, kind: 'resume_parse', errorType: 'timeout' },
      },
    ],
    [
      'a read insight unlocked',
      {
        ...ROW,
        readAt: '2026-11-13T10:00:00.000Z',
        type: 'insight_unlocked',
        payload: { applications: 10 },
      },
    ],
  ])('keeps %s notification as sent', (_label, notification) => {
    expect(notificationSchema.parse(notification)).toStrictEqual(notification);
  });

  it.each([
    {
      label: 'an AI failed without an error type',
      notification: { type: 'ai_failed', payload: AI_DONE },
      path: 'payload.errorType',
    },
    {
      label: 'an insight unlocked at zero applications',
      notification: { type: 'insight_unlocked', payload: { applications: 0 } },
      path: 'payload.applications',
    },
    {
      label: 'a silence carrying an AI payload',
      notification: { type: 'silence', payload: AI_DONE },
      path: 'payload.items',
    },
  ])('refuses $label', ({ notification, path }) => {
    expect(issuePathsOf(notificationSchema.safeParse({ ...ROW, ...notification }))).toEqual([path]);
  });
});

describe('notificationListQuerySchema', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads unread=%s as a boolean', (unread, expected) => {
    expect(notificationListQuerySchema.parse({ unread })).toEqual({ limit: 50, unread: expected });
  });

  it.each([
    { label: 'unread=maybe', query: { unread: 'maybe' }, path: 'unread' },
    { label: 'a cursor that is not a notification id', query: { cursor: 'abc' }, path: 'cursor' },
  ])('refuses $label', ({ query, path }) => {
    expect(issuePathsOf(notificationListQuerySchema.safeParse(query))).toEqual([path]);
  });
});

describe('markNotificationsReadInputSchema', () => {
  it.each([
    ['one id', { ids: [NOTIFICATION_ID] }],
    ['a hundred ids', { ids: Array.from({ length: 100 }, () => NOTIFICATION_ID) }],
    ['all', { all: true }],
  ])('accepts %s', (_label, body) => {
    expect(markNotificationsReadInputSchema.parse(body)).toStrictEqual(body);
  });

  it.each([
    ['no ids', { ids: [] }],
    ['101 ids', { ids: Array.from({ length: 101 }, () => NOTIFICATION_ID) }],
    ['all set to false', { all: false }],
    ['an id that is not a uuid', { ids: ['abc'] }],
  ])('refuses %s', (_label, body) => {
    expect(markNotificationsReadInputSchema.safeParse(body).success).toBe(false);
  });

  it('refuses a negative unread count in the answer', () => {
    expect(markNotificationsReadResponseSchema.safeParse({ unread: -1 }).success).toBe(false);
  });
});
