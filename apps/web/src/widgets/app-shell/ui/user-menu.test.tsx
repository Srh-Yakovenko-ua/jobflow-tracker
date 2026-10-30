import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { describe, expect, it } from 'vitest';

import { userKeys } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { UserMenu } from './user-menu';

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
