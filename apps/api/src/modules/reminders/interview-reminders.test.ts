import { describe, expect, it } from 'vitest';

import { minutesAfter, NOW } from '../../test/time.js';
import { INTERVIEW_REMINDER_LEADS_MIN, nextInterviewReminderAt } from './interview-reminders.js';

describe('nextInterviewReminderAt', () => {
  it('reminds 2 hours and then 15 minutes before an interview', () => {
    expect(INTERVIEW_REMINDER_LEADS_MIN).toEqual([120, 15]);
  });

  it.each([
    { case: '3 hours before', startsAt: minutesAfter(180), reminder: '2026-10-22T10:00:00.000Z' },
    { case: '1 hour before', startsAt: minutesAfter(60), reminder: '2026-10-22T09:45:00.000Z' },
    { case: '10 minutes before', startsAt: minutesAfter(10), reminder: null },
    { case: 'an interview that has started', startsAt: minutesAfter(-1), reminder: null },
  ])('picks the next lead mark $case', ({ startsAt, reminder }) => {
    expect(nextInterviewReminderAt(startsAt, NOW)?.toISOString() ?? null).toBe(reminder);
  });

  it('skips a lead mark that falls exactly on now', () => {
    expect(nextInterviewReminderAt(minutesAfter(120), NOW)?.toISOString()).toBe(
      '2026-10-22T10:45:00.000Z',
    );
  });
});
