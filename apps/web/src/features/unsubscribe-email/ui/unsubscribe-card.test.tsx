import type { EmailUnsubscribeInput, EmailUnsubscribeResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, errorReply } from '@/test/api-handlers';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { UnsubscribeCard } from './unsubscribe-card';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const TOKEN = 'header.payload.signature';

const CONFIRM = { name: 'Відписатися' } as const;

const UNSUBSCRIBED: EmailUnsubscribeResponse = { type: 'monthly_summary_ready' };

const INVALID_LINK = 'Посилання для відписки не працює';

function unsubscribeRoute(reply: HttpResponseResolver = () => HttpResponse.json(UNSUBSCRIBED)) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl('/email/unsubscribe'), async (info) => {
      sent.push(await info.request.clone().json());
      return reply(info);
    }),
  );
  return sent;
}

describe('UnsubscribeCard', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('sends nothing before the confirm button is pressed', async () => {
    const sent = unsubscribeRoute();

    renderInApp(<UnsubscribeCard token={TOKEN} />);

    expect(await screen.findByRole('button', CONFIRM)).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('confirm posts the token once and names the email type turned off', async () => {
    const sent = unsubscribeRoute();
    const user = renderInApp(<UnsubscribeCard token={TOKEN} />);

    await user.click(screen.getByRole('button', CONFIRM));

    expect(
      await screen.findByText(
        'Листи «Місячне AI-саммарі» більше не приходитимуть. Увімкнути їх знову можна в налаштуваннях, розділ «Повідомлення».',
      ),
    ).toBeDefined();
    const expected: EmailUnsubscribeInput[] = [{ token: TOKEN }];
    expect(sent).toEqual(expected);
    expect(screen.queryByRole('button', CONFIRM)).toBeNull();
    expect(screen.getByRole('link', { name: 'Відкрити налаштування' }).getAttribute('href')).toBe(
      '/settings#notifications',
    );
  });

  it('a link the API refuses with 401 shows the invalid-link state and no save-failed toast', async () => {
    unsubscribeRoute(() => errorReply({ status: 401, type: 'unauthorized' }));
    const user = renderInApp(<UnsubscribeCard token={TOKEN} />);

    await user.click(screen.getByRole('button', CONFIRM));

    expect(await screen.findByRole('heading', { name: INVALID_LINK })).toBeDefined();
    expect(screen.queryByRole('button', CONFIRM)).toBeNull();
    expect(toast.getToasts()).toEqual([]);
  });

  it('a link without a token shows the invalid-link state and sends nothing', () => {
    const sent = unsubscribeRoute();

    renderInApp(<UnsubscribeCard token={undefined} />);

    expect(screen.getByRole('heading', { name: INVALID_LINK })).toBeDefined();
    expect(screen.queryByRole('button', CONFIRM)).toBeNull();
    expect(sent).toEqual([]);
  });

  it('a server failure says so and keeps the confirm button for another try', async () => {
    const sent = unsubscribeRoute(() => errorReply({ status: 500, type: 'internal_error' }));
    const user = renderInApp(<UnsubscribeCard token={TOKEN} />);

    await user.click(screen.getByRole('button', CONFIRM));

    expect((await screen.findByRole('alert')).textContent).toContain('Не вдалося відписатися');
    expect(screen.getByRole('button', CONFIRM)).toBeDefined();
    expect(sent).toHaveLength(1);
  });
});
