import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import { AUTO_GHOSTED_NOTIFICATION, buildNotification } from '@/test/notification-fixtures';

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
