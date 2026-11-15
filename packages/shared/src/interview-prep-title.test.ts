import { describe, expect, it } from 'vitest';

import { interviewPrepTitleOf } from './interview-prep-title.js';
import { INTERVIEW_PREP_READY } from './test/notification-fixtures.js';

const KYIV = { timezone: 'Europe/Kyiv' };

const KYIV_ELEVEN_PM = '2026-11-13T21:00:00.000Z';

const KYIV_PAST_MIDNIGHT = '2026-11-13T22:30:00.000Z';

describe('interviewPrepTitleOf', () => {
  it.for([
    {
      name: "Завтра техінтерв'ю в Acme for a tech interview the next day",
      patch: {},
      createdAt: '2026-11-13T09:00:00.000Z',
      title: "Завтра техінтерв'ю в Acme",
    },
    {
      name: 'Сьогодні for an interview later the same day',
      patch: { startsAt: '2026-11-13T15:00:00.000Z' },
      createdAt: '2026-11-13T09:00:00.000Z',
      title: "Сьогодні техінтерв'ю в Acme",
    },
    {
      name: 'the label of a final interview',
      patch: { eventKind: 'final_interview' as const },
      createdAt: '2026-11-13T09:00:00.000Z',
      title: 'Завтра фінал в Acme',
    },
    {
      name: 'Завтра across midnight in Kyiv, though the same UTC day',
      patch: { startsAt: KYIV_PAST_MIDNIGHT },
      createdAt: KYIV_ELEVEN_PM,
      title: "Завтра техінтерв'ю в Acme",
    },
    {
      name: 'the date for an interview further away',
      patch: { startsAt: '2026-11-16T09:00:00.000Z' },
      createdAt: '2026-11-13T09:00:00.000Z',
      title: "16 листопада техінтерв'ю в Acme",
    },
  ])('$name', ({ patch, createdAt, title }) => {
    const notification = { payload: { ...INTERVIEW_PREP_READY, ...patch }, createdAt };
    expect(interviewPrepTitleOf(notification, KYIV)).toBe(title);
  });

  it("reads the day in the user's timezone: the same pair is Сьогодні in UTC", () => {
    const notification = {
      payload: { ...INTERVIEW_PREP_READY, startsAt: KYIV_PAST_MIDNIGHT },
      createdAt: KYIV_ELEVEN_PM,
    };
    expect(interviewPrepTitleOf(notification, { timezone: 'UTC' })).toBe(
      "Сьогодні техінтерв'ю в Acme",
    );
  });
});
