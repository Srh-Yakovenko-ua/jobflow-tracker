import { describe, expect, it } from 'vitest';

import { isWeekPaused, localDateOf, streakOf, weekStartOf, weekStatusOf } from './rhythm-weeks.js';
import type { RhythmWeekCounts, RhythmWeekStatus } from './schemas/rhythm.js';

const KYIV = { timezone: 'Europe/Kyiv' };

const NEW_YORK = { timezone: 'America/New_York' };

const QUIET_WEEK: RhythmWeekCounts = { applications: 0, followups: 0, interviews: 0, offers: 0 };

const GOAL = { applications: 5, followups: null };

const CLOSED_WEEK = { goal: GOAL, paused: false, current: false };

describe('weekStartOf', () => {
  it.each([
    {
      label: 'Sunday 23:30 in Kyiv stays in the old week',
      at: '2026-06-14T20:30:00.000Z',
      weekStart: '2026-06-08',
    },
    {
      label: 'Monday 00:10 in Kyiv opens the new week',
      at: '2026-06-14T21:10:00.000Z',
      weekStart: '2026-06-15',
    },
    {
      label: 'the Sunday the clocks go forward stays in its week',
      at: '2026-03-29T12:00:00.000Z',
      weekStart: '2026-03-23',
    },
    {
      label: 'Monday 00:10 after the clocks go forward opens a week',
      at: '2026-03-29T21:10:00.000Z',
      weekStart: '2026-03-30',
    },
    {
      label: 'Sunday 23:30 after the clocks go back stays in its week',
      at: '2026-10-25T21:30:00.000Z',
      weekStart: '2026-10-19',
    },
    {
      label: 'Monday 00:10 after the clocks go back opens a week',
      at: '2026-10-25T22:10:00.000Z',
      weekStart: '2026-10-26',
    },
  ])('$label', ({ at, weekStart }) => {
    expect(weekStartOf(KYIV, new Date(at))).toBe(weekStart);
  });

  it('puts one instant in different weeks for Kyiv and New York', () => {
    const at = new Date('2026-06-15T02:00:00.000Z');
    expect([weekStartOf(KYIV, at), weekStartOf(NEW_YORK, at)]).toEqual([
      '2026-06-15',
      '2026-06-08',
    ]);
  });
});

describe('localDateOf', () => {
  it('reads one instant as Monday in Kyiv and still Sunday in New York', () => {
    const at = new Date('2026-06-15T02:00:00.000Z');
    expect([localDateOf(KYIV, at), localDateOf(NEW_YORK, at)]).toEqual([
      '2026-06-15',
      '2026-06-14',
    ]);
  });
});

describe('isWeekPaused', () => {
  const pause = { pausedFrom: '2026-11-08', pausedUntil: '2026-11-18' };

  it.each([
    { label: 'the week before the pause', weekStart: '2026-10-26', paused: false },
    { label: 'the week whose Sunday starts the pause', weekStart: '2026-11-02', paused: true },
    { label: 'a week inside the pause', weekStart: '2026-11-09', paused: true },
    { label: 'the week the pause ends in', weekStart: '2026-11-16', paused: true },
    { label: 'the week after the pause', weekStart: '2026-11-23', paused: false },
  ])('reads $label as paused: $paused', ({ weekStart, paused }) => {
    expect(isWeekPaused(weekStart, pause)).toBe(paused);
  });

  it('reads no week as paused without a pause', () => {
    expect(isWeekPaused('2026-11-09', { pausedFrom: null, pausedUntil: null })).toBe(false);
  });
});

describe('weekStatusOf', () => {
  it.each<{ label: string; week: RhythmWeekCounts; status: RhythmWeekStatus }>([
    {
      label: 'five of five applications is in rhythm',
      week: { ...QUIET_WEEK, applications: 5 },
      status: 'in_rhythm',
    },
    {
      label: 'an interview with none of five applications is in rhythm',
      week: { ...QUIET_WEEK, interviews: 1 },
      status: 'in_rhythm',
    },
    {
      label: 'an offer with none of five applications is in rhythm',
      week: { ...QUIET_WEEK, offers: 1 },
      status: 'in_rhythm',
    },
    {
      label: 'four of five applications waits for next week',
      week: { ...QUIET_WEEK, applications: 4 },
      status: 'next_week',
    },
  ])('$label', ({ week, status }) => {
    expect(weekStatusOf(week, CLOSED_WEEK)).toBe(status);
  });

  it('waits for the follow up goal too', () => {
    const goal = { applications: 5, followups: 2 };
    const week = { ...QUIET_WEEK, applications: 5, followups: 1 };
    expect(weekStatusOf(week, { ...CLOSED_WEEK, goal })).toBe('next_week');
  });

  it('keeps the current week below the goal in progress', () => {
    expect(weekStatusOf(QUIET_WEEK, { ...CLOSED_WEEK, current: true })).toBe('in_progress');
  });

  it('marks a paused week paused even below the goal', () => {
    expect(weekStatusOf(QUIET_WEEK, { ...CLOSED_WEEK, paused: true })).toBe('paused');
  });

  it('marks a week without a goal as no goal', () => {
    const goal = { applications: null, followups: null };
    expect(weekStatusOf({ ...QUIET_WEEK, applications: 9 }, { ...CLOSED_WEEK, goal })).toBe(
      'no_goal',
    );
  });
});

describe('streakOf', () => {
  it.each<{ label: string; statuses: RhythmWeekStatus[]; streak: number }>([
    {
      label: 'counts the weeks in rhythm back from the newest',
      statuses: ['in_rhythm', 'next_week', 'in_rhythm', 'in_rhythm', 'in_rhythm'],
      streak: 3,
    },
    {
      label: 'skips a pause without breaking the streak',
      statuses: ['in_rhythm', 'paused', 'paused', 'in_rhythm'],
      streak: 2,
    },
    {
      label: 'skips the current week while it is in progress',
      statuses: ['in_rhythm', 'in_rhythm', 'in_progress'],
      streak: 2,
    },
    {
      label: 'counts the current week once it is in rhythm',
      statuses: ['next_week', 'in_rhythm', 'in_rhythm'],
      streak: 2,
    },
    {
      label: 'stops at a week without a goal',
      statuses: ['in_rhythm', 'no_goal', 'in_rhythm'],
      streak: 1,
    },
    {
      label: 'starts at zero after a week below the goal',
      statuses: ['in_rhythm', 'next_week'],
      streak: 0,
    },
    { label: 'is zero for no weeks', statuses: [], streak: 0 },
  ])('$label', ({ statuses, streak }) => {
    expect(streakOf(statuses.map((status) => ({ status })))).toBe(streak);
  });
});
