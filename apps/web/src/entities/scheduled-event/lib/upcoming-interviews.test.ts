import { describe, expect, it } from 'vitest';

import {
  INTERVIEW_CALENDAR,
  INTERVIEW_CALENDAR_BODY,
  NEXT_INTERVIEW,
  REMINDER_NOW,
} from '@/test/reminder-fixtures';

import { upcomingInterviewsOf } from './upcoming-interviews';

describe('upcomingInterviewsOf', () => {
  it('keeps planned events from now on, the soonest first, without done, cancelled or started ones', () => {
    const { items } = INTERVIEW_CALENDAR_BODY;

    expect(upcomingInterviewsOf({ items, now: REMINDER_NOW }).map((item) => item.id)).toEqual([
      INTERVIEW_CALENDAR.startingNow.id,
      NEXT_INTERVIEW.id,
      INTERVIEW_CALENDAR.laterCall.id,
    ]);
  });

  it('a week with only followups has no interview to show', () => {
    expect(
      upcomingInterviewsOf({ items: [INTERVIEW_CALENDAR.followup], now: REMINDER_NOW }),
    ).toEqual([]);
  });
});
