import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import {
  AUTO_GHOSTED_NOTIFICATION,
  buildNotification,
  EXPORT_READY_NOTIFICATION,
  INTERVIEW_PREP_READY_NOTIFICATION,
  RHYTHM_WEEK_CLOSED_NOTIFICATION,
} from '@/test/notification-fixtures';

import { notificationCopyOf } from './notification-copy';

const TIME_ZONE = 'Europe/Kyiv';

describe('notificationCopyOf', () => {
  it('auto_ghosted names how many companies went silent past the setting and where they went', () => {
    expect(notificationCopyOf(AUTO_GHOSTED_NOTIFICATION, TIME_ZONE)).toEqual({
      title: '2 компанії мовчать понад 30 днів, перенесено в ghosted',
      text: 'Acme, Kvit Software · 34 дні без відповіді',
      action: 'Відкрити дошку',
    });
  });

  it('export_ready names the archive format and leads to its download', () => {
    expect(notificationCopyOf(EXPORT_READY_NOTIFICATION, TIME_ZONE)).toEqual({
      title: 'Архів з даними готовий',
      text: 'Архів CSV чекає в налаштуваннях акаунта.',
      action: 'Завантажити архів',
    });
  });

  it('interview_prep_ready names the day, the interview kind and the company, and says the prep is ready', () => {
    expect(notificationCopyOf(INTERVIEW_PREP_READY_NOTIFICATION, TIME_ZONE)).toEqual({
      title: "Завтра техінтерв'ю в Acme",
      text: 'Підготовка готова',
      action: 'Відкрити картку',
    });
  });

  it('rhythm_week_closed in rhythm counts the week and adds the suggested pace', () => {
    expect(notificationCopyOf(RHYTHM_WEEK_CLOSED_NOTIFICATION, TIME_ZONE)).toEqual({
      title: 'Тиждень закрито: 8 відгуків і 3 фоллоу-апи',
      text: 'Ти у ритмі. 10 відгуків на тиждень наблизять офер приблизно на 2 тижні.',
      action: 'Відкрити аналітику',
    });
  });

  it.each([
    {
      name: 'below the goal and without a suggestion only offers a new start',
      payload: { applications: 1, followups: 1, inRhythm: false, suggestedGoal: null },
      title: 'Тиждень закрито: 1 відгук і 1 фоллоу-ап',
      text: 'Наступний тиждень, новий старт.',
    },
    {
      name: 'below the goal agrees the suggestion with one application and one week',
      payload: { applications: 0, followups: 5, inRhythm: false, suggestedGoal: 1, weeksSooner: 1 },
      title: 'Тиждень закрито: 0 відгуків і 5 фоллоу-апів',
      text: 'Наступний тиждень, новий старт. 1 відгук на тиждень наблизить офер приблизно на 1 тиждень.',
    },
  ])('rhythm_week_closed $name', ({ payload, title, text }) => {
    const notification = buildNotification({
      serial: 12,
      type: 'rhythm_week_closed',
      payload: { ...RHYTHM_WEEK_CLOSED_NOTIFICATION.payload, ...payload },
    });

    expect(notificationCopyOf(notification, TIME_ZONE)).toMatchObject({ title, text });
  });

  it('auto_ghosted agrees the verb with one company and reads the days from the setting', () => {
    const notification = buildNotification({
      serial: 7,
      type: 'auto_ghosted',
      payload: {
        items: [{ applicationId: fixtureIdOf(71), company: 'Grammarly', days: 45 }],
        autoGhostDays: 45,
      },
    });

    expect(notificationCopyOf(notification, TIME_ZONE).title).toBe(
      '1 компанія мовчить понад 45 днів, перенесено в ghosted',
    );
  });
});
