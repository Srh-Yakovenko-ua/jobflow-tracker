import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { NAV_ITEMS, type ShellNav } from '../model/nav-items';
import { SidebarStoreProvider } from '../model/sidebar-store';
import { BottomBar } from './bottom-bar';
import { Sidebar } from './sidebar';

const ON_ANALYTICS: ShellNav = {
  items: NAV_ITEMS,
  activeHref: '/analytics',
  badges: { silent: 0 },
};

const MARKED = { current: 'page', marker: true };

const UNMARKED = { current: null, marker: false };

function marksIn(region: HTMLElement) {
  return Object.fromEntries(
    within(region)
      .getAllByRole('link')
      .map((link) => [
        link.getAttribute('href') ?? '',
        {
          current: link.getAttribute('aria-current'),
          marker: link.querySelector('[data-marker]') !== null,
        },
      ]),
  );
}

function renderShellNav({ collapsed }: { collapsed: boolean }) {
  render(
    <SidebarStoreProvider initial={{ collapsed }}>
      <Sidebar nav={ON_ANALYTICS} />
      <BottomBar nav={ON_ANALYTICS} />
    </SidebarStoreProvider>,
  );
  return {
    sidebar: screen.getByRole('navigation', { name: uk.shell.navLabel }),
    bar: screen.getByRole('navigation', { name: uk.shell.bottomNavLabel }),
  };
}

describe('Sidebar and BottomBar', () => {
  it.each([{ collapsed: false }, { collapsed: true }])(
    'with collapsed $collapsed only Аналітика carries aria-current and the marker, and every page keeps its name',
    ({ collapsed }) => {
      const { sidebar } = renderShellNav({ collapsed });

      expect(marksIn(sidebar)).toEqual({
        '/board': UNMARKED,
        '/analytics': MARKED,
        '/calendar': UNMARKED,
        '/resumes': UNMARKED,
        '/reminders': UNMARKED,
        '/settings': UNMARKED,
      });
      expect(
        within(sidebar)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Дошка', 'Аналітика', 'Календар', 'Резюме', 'Нагадування', 'Налаштування']);
    },
  );

  it('the bottom bar leaves settings to the user menu and marks Аналітика the same way', () => {
    const { bar } = renderShellNav({ collapsed: false });

    expect(marksIn(bar)).toEqual({
      '/board': UNMARKED,
      '/analytics': MARKED,
      '/calendar': UNMARKED,
      '/resumes': UNMARKED,
      '/reminders': UNMARKED,
    });
  });
});
