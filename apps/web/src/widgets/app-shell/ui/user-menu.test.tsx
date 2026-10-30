import { act, screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { API_CLIENT_LIMITS, setAccessToken } from '@/shared/api';
import { uk } from '@/shared/i18n';
import {
  apiUrl,
  errorReply,
  expiringRoute,
  OUTAGES,
  recordSentRequests,
  SESSION_TOKENS,
} from '@/test/api-handlers';
import { resetSignIn } from '@/test/auth-form';
import { replace } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { UserMenu } from './user-menu';

vi.mock('next/navigation', () => import('@/test/navigation'));

const LOGOUT_URL = apiUrl('/auth/logout');

const SESSION_MARKER = 'jobflow_session=1';

function renderUserMenu() {
  const user = renderInApp(
    <>
      <UserMenu />
      <QueryProbe queryKey={userKeys.me()} />
    </>,
  );
  return { user, trigger: screen.getByRole('button', { name: uk.shell.userMenu }) };
}

async function openWithKeyboard() {
  const rendered = renderUserMenu();
  await within(rendered.trigger).findByText('АК');
  await rendered.user.tab();
  await rendered.user.keyboard('{Enter}');
  return { ...rendered, menu: await screen.findByRole('menu') };
}

async function chooseLogout(logoutReply: HttpResponseResolver) {
  setAccessToken(SESSION_TOKENS.fresh);
  server.use(
    expiringRoute({ url: apiUrl('/auth/me'), freshToken: SESSION_TOKENS.fresh, body: ME_RESPONSE }),
    http.post(LOGOUT_URL, logoutReply),
  );
  const { user, menu, trigger } = await openWithKeyboard();
  await user.keyboard('{End}');
  expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Вийти' }));
  await user.keyboard('{Enter}');
  return trigger;
}

afterEach(() => {
  resetSignIn();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UserMenu', () => {
  it('shows the initials on the avatar and the name and email in the open menu', async () => {
    server.use(meRoute());
    const { menu } = await openWithKeyboard();

    expect(within(menu).getByText(ME_RESPONSE.user.displayName ?? '')).toBeDefined();
    expect(within(menu).getByText(ME_RESPONSE.user.email)).toBeDefined();
  });

  it('choosing Темна with the keyboard paints the page dark and remembers it in the cookie', async () => {
    server.use(meRoute());
    const { user, menu } = await openWithKeyboard();

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      within(menu).getByRole('menuitemradio', { name: uk.theme.dark }),
    );
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(document.cookie).toContain('jobflow_theme=dark');
  });

  it('Escape closes the menu and puts focus back on the avatar', async () => {
    server.use(meRoute());
    const { user, trigger } = await openWithKeyboard();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows the person icon when the session is refused', async () => {
    server.use(
      http.get(apiUrl('/auth/me'), () => errorReply({ status: 401, type: 'unauthorized' })),
    );
    const { trigger } = renderUserMenu();
    await waitForQuery({ queryKey: userKeys.me(), status: 'error' });

    expect(trigger.textContent).toBe('');
    expect(trigger.querySelector('svg')).not.toBeNull();
  });
});

describe('UserMenu Вийти', () => {
  it('chosen with the keyboard, it ends the session on the API, lands on login and asks the API nothing more', async () => {
    const sentRequests = recordSentRequests();

    await chooseLogout(() => new HttpResponse(null, { status: 204 }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
    expect(sentRequests().at(-1)).toEqual({
      url: LOGOUT_URL,
      method: 'POST',
      credentials: 'include',
      body: undefined,
    });
    expect(document.cookie).not.toContain(SESSION_MARKER);
  });

  it.each(OUTAGES)(
    'when the API $name, a toast says the logout failed and the session stays',
    async ({ reply, settled }) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });

      const trigger = await chooseLogout(reply);
      if (settled === 'pending') {
        await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));
      }

      expect(await screen.findByText('Не вдалося вийти')).toBeDefined();
      expect(replace).not.toHaveBeenCalled();
      expect(document.cookie).toContain(SESSION_MARKER);
      expect(trigger.textContent).toBe('АК');
    },
  );
});
