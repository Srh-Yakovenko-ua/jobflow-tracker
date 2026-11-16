import type { Notification } from '@jobflow/shared';
import { buildSummary } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import {
  interviewPrepReadyFor,
  MONTHLY_SUMMARY_NOTIFICATION,
  notificationOf,
  SILENCE_ITEM,
  SILENCE_NOTIFICATION,
} from '../../test/notifications.js';
import { APPLICATION_ID } from '../../test/service-fixtures.js';
import {
  emailContentOf,
  type EmailContext,
  type EmailedNotification,
  isEmailed,
} from './email-content.js';

const WEB = 'http://localhost:3000';

const CONTEXT: EmailContext = {
  summary: null,
  settings: { timezone: 'Europe/Kyiv' },
  webOrigin: WEB,
  now: new Date('2026-11-14T09:00:00.000Z'),
};

const ACME_ID = '0199f0a0-0000-7000-8000-000000000777';

const followUpOf = (applicationId: string) => `${WEB}/applications/${applicationId}#follow-up`;

function emailed(notification: Notification): EmailedNotification {
  if (!isEmailed(notification)) throw new Error(`${notification.type} is never emailed`);
  return notification;
}

describe('emailContentOf', () => {
  it('writes one silent card as its own subject with a follow-up link', () => {
    const content = emailContentOf(emailed(SILENCE_NOTIFICATION), CONTEXT);

    expect(content).toEqual({
      subject: 'Ромашка: 7 днів без відповіді',
      preheader: 'Час нагадати про себе: відкрий картку і напиши фоллоу-ап.',
      heading: 'Час нагадати про себе',
      paragraphs: ['Час нагадати про себе: відкрий картку і напиши фоллоу-ап.'],
      items: [
        { title: 'Ромашка', detail: '7 днів без відповіді', url: followUpOf(APPLICATION_ID) },
      ],
      action: { label: 'Написати фоллоу-ап', url: followUpOf(APPLICATION_ID) },
    });
  });

  it('lists every silent card with its own link and leads to the longest silence', () => {
    const notification = notificationOf({
      type: 'silence',
      payload: { items: [SILENCE_ITEM, { applicationId: ACME_ID, company: 'Acme', days: 12 }] },
    });

    const content = emailContentOf(emailed(notification), CONTEXT);

    expect(content.subject).toBe('2 відгуки без відповіді');
    expect(content.items).toEqual([
      { title: 'Ромашка', detail: '7 днів без відповіді', url: followUpOf(APPLICATION_ID) },
      { title: 'Acme', detail: '12 днів без відповіді', url: followUpOf(ACME_ID) },
    ]);
    expect(content.action.url).toBe(followUpOf(ACME_ID));
  });

  it('carries the summary text and its actions under the month subject', () => {
    const summary = buildSummary({ month: '2026-09' });

    const content = emailContentOf(emailed(MONTHLY_SUMMARY_NOTIFICATION), {
      ...CONTEXT,
      summary,
    });

    expect(content.subject).toBe('Саммарі за вересень готове');
    expect(content.paragraphs).toEqual([summary.text]);
    expect(content.items.map(({ title, url }) => [title, url])).toEqual([
      ["Два тижні алгоритмів перед техінтерв'ю", null],
      ['Прибрати LinkedIn Easy Apply', null],
      ['Відгукуватися лише з CV v2', null],
      ['Попросити 2 рефералки', null],
    ]);
    expect(content.action).toEqual({
      label: 'Відкрити саммарі',
      url: `${WEB}/analytics/summary/2026-09`,
    });
  });

  it('falls back to the push line when the summary is gone', () => {
    const content = emailContentOf(emailed(MONTHLY_SUMMARY_NOTIFICATION), CONTEXT);

    expect([content.paragraphs, content.items]).toEqual([
      ['Що вийшло за місяць і які кроки зробити далі.'],
      [],
    ]);
  });

  it('names an interview of tomorrow from the send time and links its Application', () => {
    const notification = interviewPrepReadyFor(new Date('2026-11-15T09:00:00.000Z'));

    const content = emailContentOf(emailed(notification), CONTEXT);

    expect([content.subject, content.heading]).toEqual([
      "Завтра техінтерв'ю в Acme",
      "Завтра техінтерв'ю в Acme",
    ]);
    expect(content.action).toEqual({
      label: 'Відкрити підготовку',
      url: `${WEB}/applications/${APPLICATION_ID}`,
    });
  });
});
