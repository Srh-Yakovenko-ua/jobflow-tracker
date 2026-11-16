import type { ApplicationResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchKeys } from '@/entities/search';
import { ACTIVE_SEARCH, ARCHIVED_SEARCH } from '@/test/analytics-fixtures';
import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { push } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import {
  finishSearchRoutes,
  type FinishSearchRoutesOptions,
  OFFER_APPLICATION,
} from '@/test/search-fixtures';
import { server } from '@/test/server';

import { FinishSearchAction } from './finish-search-action';

vi.mock('next/navigation', () => import('@/test/navigation'));

type RenderOptions = FinishSearchRoutesOptions & { application?: ApplicationResponse };

const ACTION = { name: 'Офер прийнято' } as const;

const CONFIRM = { name: 'Заархівувати пошук' } as const;

const WITHDRAW = { name: 'Відкликати всі відкриті відгуки, цього не можна скасувати' } as const;

const HINT = '84 дні, 54 відгуки, 9 співбесід. Дошку можна заархівувати, аналітика залишиться.';

const SEARCHES_KEY = searchKeys.list();

function renderAction({ application = OFFER_APPLICATION, ...options }: RenderOptions = {}) {
  const routes = finishSearchRoutes(options);
  server.use(...routes.handlers);
  const user = renderInApp(
    <>
      <QueryProbe queryKey={SEARCHES_KEY} />
      <FinishSearchAction application={application} />
    </>,
  );
  return { user, ...routes };
}

async function openDialog(options: RenderOptions = {}) {
  const rendered = renderAction(options);
  await rendered.user.click(await screen.findByRole('button', ACTION));
  const dialog = await screen.findByRole('dialog', ACTION);
  return { ...rendered, dialog };
}

afterEach(() => {
  push.mockClear();
});

describe('FinishSearchAction', () => {
  it('opens the drawn finish screen with the active search stats and withdraw picked', async () => {
    const { dialog, sent } = await openDialog();

    expect(within(dialog).getByText('Пошук завершено').className).toContain('text-offer');
    expect(screen.getByRole('dialog', { ...ACTION, description: HINT })).toBe(dialog);
    expect(within(dialog).getByRole('radio', WITHDRAW).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('button', CONFIRM).className).toContain('bg-accent');
    expect(sent).toEqual([]);
  });

  it('archiving sends one finish, refetches the searches and lands on the board with a toast', async () => {
    const { user, dialog, sent, listed } = await openDialog();

    await user.click(within(dialog).getByRole('button', CONFIRM));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/board');
    });
    expect(sent).toEqual([
      { searchId: ACTIVE_SEARCH.id, outcome: 'offer_accepted', openApplications: 'withdraw' },
    ]);
    expect(listed).toHaveLength(2);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Пошук заархівовано')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Історія пошуків' }));
    expect(push).toHaveBeenLastCalledWith('/analytics/searches');
  });

  it('a user who keeps looking moves the open applications to the new search', async () => {
    const { user, dialog, sent } = await openDialog();

    await user.click(within(dialog).getByRole('radio', { name: 'Перенести в новий пошук' }));
    await user.click(within(dialog).getByRole('button', CONFIRM));

    await waitFor(() => {
      expect(sent).toEqual([
        { searchId: ACTIVE_SEARCH.id, outcome: 'offer_accepted', openApplications: 'move' },
      ]);
    });
  });

  it.each(['No active search', 'The search is already finished'])(
    'a 409 "%s" shows the one conflict message and keeps the dialog open',
    async (detail) => {
      const { user, dialog } = await openDialog({
        reply: () => errorReply({ status: 409, type: 'conflict', detail }),
      });

      await user.click(within(dialog).getByRole('button', CONFIRM));

      expect(await screen.findByText('Цей пошук уже завершено')).toBeDefined();
      expect(screen.getByText('Онови сторінку.')).toBeDefined();
      expect(screen.queryByText('Не вдалося зберегти')).toBeNull();
      expect(screen.getByRole('dialog', ACTION)).toBe(dialog);
      expect(push).not.toHaveBeenCalled();
    },
  );

  it('any other failure says the save failed', async () => {
    const { user, dialog } = await openDialog({
      reply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    await user.click(within(dialog).getByRole('button', CONFIRM));

    expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
    expect(screen.queryByText('Цей пошук уже завершено')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('a card short of the offer stage offers no finish and asks for no searches', () => {
    const { listed } = renderAction({ application: ACME_APPLICATION });

    expect(screen.queryByRole('button', ACTION)).toBeNull();
    expect(listed).toEqual([]);
  });

  it('an offer from an archived search offers no finish', async () => {
    renderAction({ application: { ...OFFER_APPLICATION, searchId: ARCHIVED_SEARCH.id } });

    await waitForQuery({ queryKey: SEARCHES_KEY, status: 'success' });

    expect(screen.queryByRole('button', ACTION)).toBeNull();
  });
});
