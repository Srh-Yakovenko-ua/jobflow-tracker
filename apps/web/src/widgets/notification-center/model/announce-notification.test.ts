import type { Notification } from '@jobflow/shared';
import { QueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import {
  AI_DONE_NOTIFICATION,
  buildNotification,
  INTERVIEW_NOTIFICATION,
  notificationRoutes,
  SILENCE_NOTIFICATION,
  unreadMeRoute,
} from '@/test/notification-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { announceNotification } from './announce-notification';

const AI_FAILED_NOTIFICATION = buildNotification({
  serial: 4,
  type: 'ai_failed',
  payload: {
    aiJobId: fixtureIdOf(41),
    kind: 'vacancy_parse',
    applicationId: fixtureIdOf(42),
    errorType: 'timeout',
  },
});

const FEED = [
  INTERVIEW_NOTIFICATION,
  SILENCE_NOTIFICATION,
  AI_DONE_NOTIFICATION,
  AI_FAILED_NOTIFICATION,
];

function nextTask() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve);
  });
}

type AnnounceCase = Readonly<{ notification: Notification; notifyInApp?: boolean }>;

async function announced({ notification, notifyInApp = true }: AnnounceCase, times = 1) {
  server.use(
    unreadMeRoute(1, { notifyInApp }),
    ...notificationRoutes({ feed: { items: FEED, nextCursor: null } }).handlers,
  );
  const user = renderInApp(null);
  const navigate = vi.fn<(href: string) => void>();
  const queryClient = new QueryClient();
  for (let round = 0; round < times; round += 1) {
    await announceNotification({ queryClient, notificationId: notification.id, navigate });
  }
  return { user, navigate };
}

describe('announceNotification', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('an interview soon toasts with an Відкрити action to the card', async () => {
    const { user, navigate } = await announced({ notification: INTERVIEW_NOTIFICATION });

    expect(await screen.findByText('Співбесіда о 16:00')).toBeDefined();
    expect(screen.getByText('Grammarly')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Відкрити' }));
    expect(navigate).toHaveBeenCalledWith(`/applications/${fixtureIdOf(21)}`);
  });

  it.each([
    {
      name: 'a finished vacancy parse',
      notification: AI_DONE_NOTIFICATION,
      title: 'Вакансію розібрано',
    },
    {
      name: 'a failed vacancy parse',
      notification: AI_FAILED_NOTIFICATION,
      title: 'Не вдалося розібрати вакансію',
    },
  ])('$name toasts $title', async ({ notification, title }) => {
    await announced({ notification });

    expect(await screen.findByText(title)).toBeDefined();
  });

  it('the same notification announced twice shows one toast', async () => {
    await announced({ notification: INTERVIEW_NOTIFICATION }, 2);

    expect(await screen.findByText('Співбесіда о 16:00')).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it.each([
    { name: 'silence', notification: SILENCE_NOTIFICATION, notifyInApp: true },
    {
      name: 'an interview with in-app notifications off',
      notification: INTERVIEW_NOTIFICATION,
      notifyInApp: false,
    },
    {
      name: 'an id the latest page does not hold',
      notification: buildNotification({
        serial: 77,
        type: 'insight_unlocked',
        payload: { applications: 10 },
      }),
      notifyInApp: true,
    },
  ])('$name shows no toast', async (announce) => {
    await announced(announce);
    await act(nextTask);

    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
