import type { ApplicationResponse } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { DESIGN_TIMELINE_APPLICATION } from '@/test/timeline-fixtures';

import { waitingRowOf } from './waiting-row';

const KYIV = 'Europe/Kyiv';

const WAITING_AFTER_TECH = "Чекаєш на відповідь після техінтерв'ю";

function waitingOf(fields: Partial<ApplicationResponse>) {
  const application = { ...DESIGN_TIMELINE_APPLICATION, ...fields };
  return waitingRowOf({ application, silenceDays: 7, timeZone: KYIV });
}

describe('waitingRowOf', () => {
  it('4 quiet days after the tech interview with a 7-day threshold remind on 10.09', () => {
    expect(waitingOf({})).toEqual({
      title: WAITING_AFTER_TECH,
      meta: '4 дні тиші. Поріг фоллоу-апу — 7 днів, нагадаємо 10.09.',
    });
  });

  it('the final stage doubles the threshold to 14 days', () => {
    expect(waitingOf({ currentStage: 'final' })).toEqual({
      title: 'Чекаєш на відповідь після фіналу',
      meta: '4 дні тиші. Поріг фоллоу-апу — 14 днів, нагадаємо 17.09.',
    });
  });

  it('the remind date is the calendar day in the user timezone', () => {
    expect(waitingOf({ lastEventAt: '2026-09-03T22:30:00Z' })?.meta).toBe(
      '4 дні тиші. Поріг фоллоу-апу — 7 днів, нагадаємо 11.09.',
    );
  });

  it.for([
    { days: 7, meta: '7 днів тиші. Поріг фоллоу-апу — 7 днів пройдено.' },
    { days: 9, meta: '9 днів тиші. Поріг фоллоу-апу — 7 днів пройдено.' },
  ])('$days quiet days reach the threshold and say it has passed', ({ days, meta }) => {
    expect(waitingOf({ daysSinceLastEvent: days })).toEqual({ title: WAITING_AFTER_TECH, meta });
  });

  it.for<Partial<ApplicationResponse>>([
    { currentStage: 'rejected' },
    { currentStage: 'offer' },
    { isDraft: true },
  ])('an application with %o waits for nothing', (fields) => {
    expect(waitingOf(fields)).toBeNull();
  });
});
