import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { userKeys } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { apiUrl, errorReply, OUTAGES } from '@/test/api-handlers';
import { boardOf, type ColumnCounts } from '@/test/board-fixtures';
import { axeViolations } from '@/test/dev-ui';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { AppShell } from './app-shell';

vi.mock('next/navigation', () => import('@/test/navigation'));

const SHELL = uk.shell;

const SILENT_BOARD_KEY = applicationKeys.board({ silence: ['silent'] });

function silentBoardRoute(counts: ColumnCounts) {
  return http.get(apiUrl('/applications/board'), ({ request }) =>
    new URL(request.url).searchParams.get('silence') === 'silent'
      ? HttpResponse.json(boardOf(counts))
      : errorReply({ status: 422, type: 'validation_error' }),
  );
}

function renderShell() {
  const user = renderInApp(
    <AppShell initial={{ collapsed: false }}>
      <QueryProbe queryKey={SILENT_BOARD_KEY} />
      <QueryProbe queryKey={userKeys.me()} />
    </AppShell>,
  );
  return { user, sidebar: screen.getByRole('navigation', { name: SHELL.navLabel }) };
}

describe('AppShell', () => {
  it('Tab walks the skip link, the collapse toggle, Дошка, Налаштування, the search and the user menu, and Enter collapses the sidebar', async () => {
    server.use(meRoute(), silentBoardRoute({}));
    const { user, sidebar } = renderShell();
    const stops = [
      screen.getByRole('link', { name: SHELL.skipToContent }),
      within(sidebar).getByRole('button', { name: SHELL.collapse }),
      within(sidebar).getByRole('link', { name: SHELL.nav.board }),
      within(sidebar).getByRole('link', { name: SHELL.nav.settings }),
      screen.getByRole('combobox', { name: SHELL.search.label }),
      screen.getByRole('button', { name: SHELL.userMenu }),
    ];

    for (const stop of stops) {
      await user.tab();
      expect(document.activeElement).toBe(stop);
    }
    await user.keyboard('{Shift>}{Tab}{Tab}{Tab}{Tab}{/Shift}');
    await user.keyboard('{Enter}');

    const toggle = within(sidebar).getByRole('button', { name: SHELL.expand });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(sidebar).getByRole('link', { name: SHELL.nav.board })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: SHELL.nav.board })).toBeDefined();
  });

  it('names the silent cards in the board link from the silent-only board counts', async () => {
    server.use(meRoute(), silentBoardRoute({ applied: 2, screening: 1 }));
    const { sidebar } = renderShell();

    const board = await within(sidebar).findByRole('link', { name: 'Дошка 3 тихі картки' });

    expect(board.getAttribute('href')).toBe('/board');
  });

  it.each(OUTAGES)(
    'while the API $name the shell still navigates, with no badge and the avatar fallback',
    async ({ reply, settled }) => {
      server.use(http.all(apiUrl('/*'), reply));
      const { user, sidebar } = renderShell();
      await waitForQuery({ queryKey: SILENT_BOARD_KEY, status: settled });
      await waitForQuery({ queryKey: userKeys.me(), status: settled });

      const board = within(sidebar).getByRole('link', { name: SHELL.nav.board });
      const avatar = screen.getByRole('button', { name: SHELL.userMenu });
      await user.tab();
      await user.tab();
      await user.tab();

      expect(document.activeElement).toBe(board);
      expect(avatar.textContent).toBe('');
      expect(avatar.querySelector('svg')).not.toBeNull();
    },
  );

  it('keeps Додати вакансію out while its page is behind the flag', async () => {
    server.use(meRoute(), silentBoardRoute({}));
    renderShell();
    await waitForQuery({ queryKey: userKeys.me(), status: 'success' });

    expect(screen.queryByRole('link', { name: SHELL.addApplication })).toBeNull();
  });

  it('passes axe with every landmark named', async () => {
    server.use(meRoute(), silentBoardRoute({ applied: 1 }));
    renderInApp(<AppShell initial={{ collapsed: false }}>{null}</AppShell>);
    await screen.findAllByRole('link', { name: 'Дошка 1 тиха картка' });

    expect(await axeViolations()).toEqual([]);
  });
});
