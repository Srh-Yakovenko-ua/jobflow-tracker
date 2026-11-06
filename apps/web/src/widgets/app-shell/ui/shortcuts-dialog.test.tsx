import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '@/test/axe';
import { EVERY_FLAG_ON } from '@/test/feature-flags';
import { pagedListRoute } from '@/test/list-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { renderInShell } from '@/test/render-in-shell';
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

function renderWithOpener() {
  server.use(pagedListRoute({ items: [] }).handler);
  const user = renderInShell(<button type="button">opener</button>);
  const opener = screen.getByRole('button', { name: 'opener' });
  act(() => {
    opener.focus();
  });
  return { user, opener };
}

function cheatSheet() {
  return screen.findByRole('dialog', { name: 'Гарячі клавіші' });
}

describe('ShortcutsDialog', () => {
  it('? opens «Гарячі клавіші» with the palette, the search and every shortcut shipped today, and Escape puts focus back', async () => {
    const { user, opener } = renderWithOpener();

    await user.keyboard('?');
    const dialog = await cheatSheet();
    expect(rowsOf(dialog)).toEqual([
      ['Палітра команд', 'Ctrl K'],
      ['Пошук вакансій', '/'],
      ['Відкрити дошку', 'G потім B'],
      ['Гарячі клавіші', '?'],
    ]);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it('once N, G A and G R ship it lists them too, and names the palette ⌘ K on a Mac', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(APPLE_AGENT);
    renderInApp(
      <ShortcutsDialog
        state={{ open: true, onOpenChange: vi.fn() }}
        shortcuts={shortcutsOf(EVERY_FLAG_ON)}
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
    const { user, opener } = renderWithOpener();

    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: 'Палітра команд' });
    await user.keyboard('Гарячі клавіші');
    await screen.findByRole('option', { name: 'Гарячі клавіші' });
    await user.keyboard('{Enter}');
    await cheatSheet();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it('Ctrl+K on the open cheat sheet swaps it for the palette', async () => {
    const { user } = renderWithOpener();

    await user.keyboard('?');
    await cheatSheet();
    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog', { name: 'Палітра команд' })).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Гарячі клавіші' })).toBeNull();
  });

  it('passes axe with the cheat sheet open', async () => {
    const { user } = renderWithOpener();

    await user.keyboard('?');
    await cheatSheet();

    expect(await axeViolations()).toEqual([]);
  });
});
