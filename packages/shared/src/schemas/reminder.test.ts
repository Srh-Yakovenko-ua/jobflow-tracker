import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  type Reminder,
  REMINDER_LIMITS,
  reminderListResponseSchema,
  snoozeReminderInputSchema,
} from './reminder.js';

describe('snoozeReminderInputSchema', () => {
  it('keeps the snooze bounds at one to thirty days', () => {
    expect(REMINDER_LIMITS).toEqual({ snoozeDays: { min: 1, max: 30 } });
  });

  it.for([
    { label: 'one day', input: { days: 1 }, paths: [] },
    { label: 'thirty days', input: { days: 30 }, paths: [] },
    { label: 'zero days', input: { days: 0 }, paths: ['days'] },
    { label: 'thirty-one days', input: { days: 31 }, paths: ['days'] },
    { label: 'a fractional day count', input: { days: 2.5 }, paths: ['days'] },
    { label: 'no day count', input: {}, paths: ['days'] },
  ])('answers $label with issues at $paths', ({ input, paths }) => {
    expect(issuePathsOf(snoozeReminderInputSchema.safeParse(input))).toEqual(paths);
  });
});

const PENDING_FOLLOWUP: Reminder = {
  id: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e30',
  applicationId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f',
  company: 'Монобанк',
  stage: 'applied',
  type: 'followup',
  status: 'pending',
  scheduledEventId: null,
  dueAt: '2026-11-09T10:00:00.000Z',
  snoozedUntil: null,
};

const SNOOZED_INTERVIEW: Reminder = {
  ...PENDING_FOLLOWUP,
  id: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e31',
  stage: 'tech_interview',
  type: 'interview_soon',
  status: 'snoozed',
  scheduledEventId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e20',
  snoozedUntil: '2026-11-12T10:00:00.000Z',
};

describe('reminderListResponseSchema', () => {
  it('keeps a pending follow-up and a snoozed interview reminder as sent', () => {
    const list = { items: [PENDING_FOLLOWUP, SNOOZED_INTERVIEW] };
    expect(reminderListResponseSchema.parse(list)).toStrictEqual(list);
  });

  it('refuses a reminder whose snooze end is not a timestamp', () => {
    const list = { items: [{ ...SNOOZED_INTERVIEW, snoozedUntil: 'tomorrow' }] };
    expect(issuePathsOf(reminderListResponseSchema.safeParse(list))).toEqual([
      'items.0.snoozedUntil',
    ]);
  });
});
