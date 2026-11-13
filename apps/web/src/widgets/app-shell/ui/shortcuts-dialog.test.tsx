import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { axeViolations } from '@/test/axe';
import { EVERY_FLAG_ON } from '@/test/feature-flags';
import { pagedListRoute } from '@/test/list-fixtures';
import { push } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
import { choose, renderSignedIn, type ShellSetup } from '@/test/render-in-shell';
import { server } from '@/test/server';

import { shortcutsOf } from '../model/palette-commands';
import { ShortcutsDialog } from './shortcuts-dialog';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const APPLE_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15';

function rowsOf(dialog: HTMLElement): string[][] {
  return within(dialog)
    .getAllByRole('term')
    .map((term) => {
      const keys = term.nextElementSibling?.children ?? [];
      return [term.textContent, Array.from(keys, (key) => key.textContent).join(' ')];
    });
}

async function renderWithOpener(settings: ShellSetup['settings'] = {}) {
  server.use(pagedListRoute({ items: [] }).handler);
  const user = await renderSignedIn(<button type="button">opener</button>, { settings });
  const opener = screen.getByRole('button', { name: 'opener' });
  act(() => {
    opener.focus();
  });
  return { user, opener };
}

function cheatSheet() {
  return screen.findByRole('dialog', { name: 'Гарячі клавіші' });
}

async function pickInPalette(user: UserEvent) {
  await choose(user, 'Гарячі клавіші');
  return cheatSheet();
}

describe('ShortcutsDialog', () => {
  it('? opens «Гарячі клавіші» with the palette, the search and every shortcut shipped today, and Escape puts focus back', async () => {
    const { user, opener } = await renderWithOpener();

    await user.keyboard('?');
    const dialog = await cheatSheet();
    expect(rowsOf(dialog)).toEqual([
      ['Палітра команд', 'Ctrl K'],
      ['Пошук вакансій', '/'],
      ['Додати вакансію', 'N'],
      ['Відкрити дошку', 'G потім B'],
      ['Відкрити аналітику', 'G потім A'],
      ['Гарячі клавіші', '?'],
    ]);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it('once G R ships it lists it too, and names the palette ⌘ K on a Mac', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(APPLE_AGENT);
    renderInApp(
      <ShortcutsDialog
        state={{ open: true, onOpenChange: vi.fn() }}
        shortcuts={shortcutsOf(EVERY_FLAG_ON)}
        singleKeys
      />,
    );

    expect(rowsOf(screen.getByRole('dialog', { name: 'Гарячі клавіші' }))).toEqual([
      ['Палітра команд', '⌘ K'],
      ['Пошук вакансій', '/'],
      ['Додати вакансію', 'N'],
      ['Відкрити дошку', 'G потім B'],
      ['Відкрити аналітику', 'G потім A'],
      ['Відкрити нагадування', 'G потім R'],
      ['Гарячі клавіші', '?'],
    ]);
    vi.restoreAllMocks();
  });

  it('«Гарячі клавіші» picked in the palette opens the cheat sheet, and closing it puts focus back where the palette was opened', async () => {
    const { user, opener } = await renderWithOpener();

    await pickInPalette(user);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it('Ctrl+K on the open cheat sheet swaps it for the palette', async () => {
    const { user } = await renderWithOpener();

    await user.keyboard('?');
    await cheatSheet();
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Палітра команд' })).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Гарячі клавіші' })).toBeNull();
  });

  it('passes axe with the cheat sheet open', async () => {
    const { user } = await renderWithOpener();

    await user.keyboard('?');
    await cheatSheet();

    expect(await axeViolations()).toEqual([]);
  });
});

describe('with single key shortcuts off', () => {
  afterEach(() => {
    push.mockClear();
  });

  it('N, G B and ? do nothing and Ctrl+K still opens the palette', async () => {
    const { user } = await renderWithOpener({ singleKeyShortcuts: false });

    await user.keyboard('ngb?');
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Палітра команд' })).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Гарячі клавіші' })).toBeNull();
  });

  it('the cheat sheet picked in the palette marks every single key shortcut as off and says where to turn them on', async () => {
    const { user } = await renderWithOpener({ singleKeyShortcuts: false });

    const dialog = await pickInPalette(user);

    expect(rowsOf(dialog)).toEqual([
      ['Палітра команд', 'Ctrl K'],
      ['Пошук вакансій', '/ вимкнено'],
      ['Додати вакансію', 'N вимкнено'],
      ['Відкрити дошку', 'G потім B вимкнено'],
      ['Відкрити аналітику', 'G потім A вимкнено'],
      ['Гарячі клавіші', '? вимкнено'],
    ]);
    expect(
      within(dialog).getByText(
        'Гарячі клавіші з однієї літери вимкнено в налаштуваннях, розділ «Вигляд і тема».',
      ),
    ).toBeDefined();
  });
});
