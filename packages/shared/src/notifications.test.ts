import { describe, expect, it } from 'vitest';

import {
  aiDoneNotificationPayloadSchema,
  interviewSoonNotificationPayloadSchema,
  markNotificationsReadInputSchema,
  markNotificationsReadResponseSchema,
  type Notification,
  notificationListQuerySchema,
  notificationSchema,
  silenceNotificationPayloadSchema,
} from './notifications.js';
import {
  AI_DONE,
  EXPORT_READY,
  INTERVIEW_PREP_READY,
  INTERVIEW_SOON,
  MONTHLY_SUMMARY_READY,
  NOTIFICATION_ID,
  NOTIFICATION_ROW as ROW,
  RHYTHM_WEEK_CLOSED,
  SILENCE,
  SILENCE_ITEM,
} from './test/notification-fixtures.js';
import { issuePathsOf } from './test/zod-issues.js';

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
    [
      'a monthly summary ready',
      { ...ROW, type: 'monthly_summary_ready', payload: MONTHLY_SUMMARY_READY },
    ],
    [
      'an auto ghosted',
      { ...ROW, type: 'auto_ghosted', payload: { ...SILENCE, autoGhostDays: 30 } },
    ],
    ['an export ready', { ...ROW, type: 'export_ready', payload: EXPORT_READY }],
    [
      'an interview prep ready',
      { ...ROW, type: 'interview_prep_ready', payload: INTERVIEW_PREP_READY },
    ],
    ['a rhythm week closed', { ...ROW, type: 'rhythm_week_closed', payload: RHYTHM_WEEK_CLOSED }],
    [
      'a rhythm week closed below the goal with no suggestion',
      {
        ...ROW,
        type: 'rhythm_week_closed',
        payload: { ...RHYTHM_WEEK_CLOSED, inRhythm: false, suggestedGoal: null, weeksSooner: null },
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
      label: 'a monthly summary ready for a month with a day',
      notification: {
        type: 'monthly_summary_ready',
        payload: { ...MONTHLY_SUMMARY_READY, month: '2026-08-01' },
      },
      path: 'payload.month',
    },
    {
      label: 'a plan item due, which has no payload yet',
      notification: { type: 'plan_item_due', payload: MONTHLY_SUMMARY_READY },
      path: 'type',
    },
    {
      label: 'a silence carrying an AI payload',
      notification: { type: 'silence', payload: AI_DONE },
      path: 'payload.items',
    },
    {
      label: 'an auto ghosted without the day setting',
      notification: { type: 'auto_ghosted', payload: SILENCE },
      path: 'payload.autoGhostDays',
    },
    {
      label: 'an export ready in a format the export does not write',
      notification: { type: 'export_ready', payload: { ...EXPORT_READY, format: 'xlsx' } },
      path: 'payload.format',
    },
    {
      label: 'an export ready whose export id is not a uuid',
      notification: { type: 'export_ready', payload: { ...EXPORT_READY, exportId: 'abc' } },
      path: 'payload.exportId',
    },
    {
      label: 'an interview prep ready for an event kind the schedule does not know',
      notification: {
        type: 'interview_prep_ready',
        payload: { ...INTERVIEW_PREP_READY, eventKind: 'mock_interview' },
      },
      path: 'payload.eventKind',
    },
    {
      label: 'an interview prep ready without its AI job',
      notification: {
        type: 'interview_prep_ready',
        payload: { ...INTERVIEW_PREP_READY, aiJobId: undefined },
      },
      path: 'payload.aiJobId',
    },
    {
      label: 'a rhythm week closed whose week start carries a time',
      notification: {
        type: 'rhythm_week_closed',
        payload: { ...RHYTHM_WEEK_CLOSED, weekStart: '2026-11-09T00:00:00Z' },
      },
      path: 'payload.weekStart',
    },
    {
      label: 'a rhythm week closed that brings the offer zero weeks sooner',
      notification: {
        type: 'rhythm_week_closed',
        payload: { ...RHYTHM_WEEK_CLOSED, weeksSooner: 0 },
      },
      path: 'payload.weeksSooner',
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
