import { describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import {
  interviewSoonAt,
  MONTHLY_SUMMARY_NOTIFICATION,
  notificationOf,
  SILENCE_ITEM,
  SILENCE_NOTIFICATION,
} from '../../test/notifications.js';
import { APPLICATION_ID, MISSING_ID } from '../../test/service-fixtures.js';
import { isPushed, pushMessageOf } from './push-message.js';

const KYIV = { timezone: 'Europe/Kyiv' };

const LONGER_SILENCE = { applicationId: MISSING_ID, company: 'Globex', days: 12 };

const message = (notification: Parameters<typeof isPushed>[0]) => {
  if (!isPushed(notification)) throw new Error(`${notification.type} is not pushed`);
  return pushMessageOf(notification, KYIV);
};

describe('pushMessageOf', () => {
  it('names the company and the silent days of a silence reminder and opens its follow-up', () => {
    expect(message(SILENCE_NOTIFICATION)).toEqual({
      title: 'Ромашка: 7 днів без відповіді',
      body: 'Час нагадати про себе: відкрий картку і напиши фоллоу-ап.',
      url: `/applications/${SILENCE_ITEM.applicationId}#follow-up`,
      tag: `application:${SILENCE_ITEM.applicationId}`,
    });
  });

  it('picks the longest silent application of a grouped silence reminder', () => {
    const grouped = notificationOf({
      type: 'silence',
      payload: { items: [SILENCE_ITEM, LONGER_SILENCE] },
    });

    expect(message(grouped)).toMatchObject({
      title: 'Globex: 12 днів без відповіді',
      url: `/applications/${MISSING_ID}#follow-up`,
      tag: `application:${MISSING_ID}`,
    });
  });

  it('gives the local start time of an interview and opens its card', () => {
    expect(message(interviewSoonAt(new Date('2026-11-14T12:30:00.000Z')))).toEqual({
      title: 'Співбесіда о 14:30',
      body: 'Ромашка',
      url: `/applications/${SILENCE_ITEM.applicationId}`,
      tag: `application:${SILENCE_ITEM.applicationId}`,
    });
  });

  it('lists the companies moved to ghosted and opens the board', () => {
    const ghosted = notificationOf({
      type: 'auto_ghosted',
      payload: { items: [SILENCE_ITEM, LONGER_SILENCE], autoGhostDays: 30 },
    });

    expect(message(ghosted)).toEqual({
      title: 'Перенесено в ghosted',
      body: 'Ромашка, Globex · понад 30 днів без відповіді',
      url: '/board',
      tag: 'auto-ghosted',
    });
  });

  it('names the day, the interview kind and the company of a ready prep pack and opens its card', () => {
    const ready = notificationOf({
      type: 'interview_prep_ready',
      payload: {
        aiJobId: AI_JOB_ID,
        applicationId: APPLICATION_ID,
        company: 'Acme',
        eventKind: 'tech_interview',
        startsAt: '2026-10-23T08:00:00.000Z',
      },
    });

    expect(message(ready)).toEqual({
      title: "Завтра техінтерв'ю в Acme",
      body: 'Підготовка готова',
      url: `/applications/${APPLICATION_ID}`,
      tag: `interview-prep:${APPLICATION_ID}`,
    });
  });

  it('names the month of a ready summary and opens it', () => {
    expect(message(MONTHLY_SUMMARY_NOTIFICATION)).toEqual({
      title: 'Саммарі за вересень готове',
      body: 'Що вийшло за місяць і які кроки зробити далі.',
      url: '/analytics/summary/2026-09',
      tag: 'summary:2026-09',
    });
  });

  it.each([
    { type: 'ai_done', payload: { aiJobId: MISSING_ID, kind: 'vacancy_parse' } },
    { type: 'insight_unlocked', payload: { applications: 10 } },
    { type: 'export_ready', payload: { exportId: MISSING_ID, format: 'csv' } },
  ] as const)('pushes no $type', (content) => {
    expect(isPushed(notificationOf(content))).toBe(false);
  });
});
