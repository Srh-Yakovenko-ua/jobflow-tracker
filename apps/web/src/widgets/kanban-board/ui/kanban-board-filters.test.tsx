import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationFiltersOf } from '@/features/filter-applications';
import { layOutColumns } from '@/test/board-drag';
import { chipNames, CHIPS_NAME, pickSource, searchField } from '@/test/board-filters';
import { boardRoute, cardsIn, DESIGN_BOARD, snippetCardIn } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { columnNamed, renderBoard } from '@/test/render-board';
import { server } from '@/test/server';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

function sentWith(sent: readonly string[], name: string): string[] {
  return sent.filter((query) => query.includes(name));
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('KanbanBoard search and filters', () => {
  it('a reload with filters in the URL asks for them, keeps the stage in the browser, refills the search and shows each chip', async () => {
    const filters = applicationFiltersOf({
      source: 'djinni',
      q: 'kafka',
      salaryFrom: '3000',
      stage: 'screening',
    });
    const { sent } = renderBoard(DESIGN_BOARD, { filters });

    expect(await screen.findByRole('heading', { name: 'скринінг 1' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'відгук 2' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'відмова 32' })).toBeNull();
    expect(sent).toEqual(['source=djinni&q=kafka&salaryFrom=3000']);
    expect(searchField().value).toBe('kafka');
    expect(chipNames()).toEqual(['джерело: Djinni', 'етап: скринінг', 'зарплата від 3 000']);
  });

  it('picking a source in its pill writes the URL, names the pill and adds a chip, and removing the chip takes all three back', async () => {
    const { user, sent } = renderBoard(DESIGN_BOARD);
    await pickSource(user);

    expect(window.location.search).toBe('?source=djinni');
    expect(screen.getByRole('button', { name: 'Джерело: Djinni' })).toBeDefined();
    expect(chipNames()).toEqual(['джерело: Djinni']);
    await waitFor(() => {
      expect(sent).toEqual(['', 'source=djinni']);
    });

    await user.click(screen.getByRole('button', { name: 'Прибрати джерело: Djinni' }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('list', { name: CHIPS_NAME })).toBeNull();
    expect(screen.getByRole('button', { name: 'Джерело: усі' })).toBeDefined();
    expect(document.activeElement).toBe(searchField());
  });

  it('opening a strip under a source filter keeps the filter in the request', async () => {
    const { user, sent } = renderBoard(DESIGN_BOARD, { filters: { source: ['djinni'] } });
    await user.click(await screen.findByRole('button', { name: 'відмова 32' }));

    await waitFor(() => {
      expect(sent).toEqual(['source=djinni', 'source=djinni&expand=rejected']);
    });
  });

  it('the search asks once after 250 ms of quiet while the URL follows every key, and its clear button empties both', async () => {
    fakeTimeouts();
    const { user, sent } = renderBoard(DESIGN_BOARD);
    await screen.findByRole('heading', { name: 'відгук 2' });
    await user.type(searchField(), 'kafka');

    expect(window.location.search).toBe('?q=kafka');
    expect(sent).toEqual(['']);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => {
      expect(sent).toEqual(['', 'q=kafka']);
    });

    await user.click(screen.getByRole('button', { name: 'Скинути' }));

    expect(searchField().value).toBe('');
    expect(window.location.search).toBe('');
    expect(document.activeElement).toBe(searchField());
  });

  it('a letter typed right after the clear button keeps the whole board, never the cleared search', async () => {
    fakeTimeouts();
    const { user } = renderBoard({ ...DESIGN_BOARD, emptyFor: ['q'] });
    await screen.findByRole('heading', { name: 'відгук 2' });
    await user.type(searchField(), 'kafka');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await screen.findByRole('heading', { name: 'Немає карток за «kafka»' });

    await user.click(screen.getByRole('button', { name: 'Скинути' }));
    await user.type(searchField(), 'r');

    expect(screen.queryByRole('heading', { name: 'Немає карток за «kafka»' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'відгук 2' })).toBeDefined();
  });

  it('one letter stays in the field and the URL but is not searched, two letters are', async () => {
    fakeTimeouts();
    const { user, sent } = renderBoard(DESIGN_BOARD);
    await screen.findByRole('heading', { name: 'відгук 2' });
    await user.type(searchField(), 'k');
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(window.location.search).toBe('?q=k');
    await user.type(searchField(), 'a');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => {
      expect(sent).toEqual(['', 'q=ka']);
    });
  });

  it('a search that finds nothing keeps the toolbar and shows the empty state with its chips, and the reset brings the board back', async () => {
    const { user, sent } = renderBoard(
      { ...DESIGN_BOARD, emptyFor: ['q'] },
      { filters: { q: 'kafka', source: ['djinni'] } },
    );

    expect(await screen.findByRole('heading', { name: 'Немає карток за «kafka»' })).toBeDefined();
    expect(
      screen.getByText(
        'Пошук іде по компанії, позиції, стеку і нотатках. Спробуй частину слова або скинь фільтри.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Пошук · нічого не знайдено')).toBeDefined();
    expect(chipNames()).toEqual(['джерело: Djinni']);
    expect(screen.queryByRole('radiogroup', { name: 'Вигляд карток' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Тут буде твоя воронка' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Скинути фільтри' }));

    expect(await screen.findByRole('heading', { name: 'відгук 2' })).toBeDefined();
    expect(window.location.search).toBe('');
    expect(sent).toEqual(['source=djinni&q=kafka', '']);
    expect(document.activeElement).toBe(searchField());
  });

  it('a stage filter with no cards in it says so about the filters, not a search text', async () => {
    renderBoard(DESIGN_BOARD, { filters: { stage: ['final'] } });

    expect(
      await screen.findByRole('heading', { name: 'Немає карток за цими фільтрами' }),
    ).toBeDefined();
  });

  it('the Фільтри pill adds a chip per control, asks for score and silence, keeps the stage in the browser and waits for the salary to settle', async () => {
    const { user, sent } = renderBoard(DESIGN_BOARD);
    await user.click(await screen.findByRole('button', { name: 'Фільтри' }));
    await user.click(screen.getByRole('checkbox', { name: 'скринінг' }));
    await user.click(screen.getByRole('checkbox', { name: 'з Match Score' }));
    await user.click(screen.getByRole('checkbox', { name: 'лише в тиші' }));
    await user.type(screen.getByRole('textbox', { name: 'Зарплата від' }), '3000');

    expect(chipNames()).toEqual([
      'етап: скринінг',
      'з Match Score',
      'лише в тиші',
      'зарплата від 3 000',
    ]);
    expect(screen.getByRole('button', { name: 'Фільтри · 4' })).toBeDefined();
    expect(screen.getByText('зарплата від 3 000').classList).toContain('tabular-nums');
    expect(
      screen.getByRole('textbox', { name: 'Зарплата від' }).parentElement?.classList,
    ).toContain('tabular-nums');
    await waitFor(() => {
      expect(sentWith(sent, 'salaryFrom')).toEqual([
        'hasScore=true&silence=silent&salaryFrom=3000',
      ]);
    });
    expect(sentWith(sent, 'stage')).toEqual([]);
    expect(screen.getByRole('heading', { name: 'скринінг 1' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'відгук 2' })).toBeNull();
  });

  it('a filter request that fails keeps the board, says so in an alert and retries', async () => {
    const { user } = renderBoard({ ...DESIGN_BOARD, failFor: ['source'] });
    await pickSource(user);

    const alert = await screen.findByRole('alert', {}, { timeout: 2500 });

    expect(alert.textContent).toContain('Не вдалося завантажити');
    expect(screen.getByRole('heading', { name: 'відгук 2' })).toBeDefined();
    server.use(boardRoute(DESIGN_BOARD).handler);
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('a search marks the matched text in a card of a short column and of a virtual one', async () => {
    layOutColumns();
    renderBoard(
      {
        counts: { applied: 1, screening: 40 },
        cards: [
          snippetCardIn({ serial: 101, stage: 'applied', position: 'Senior Frontend Engineer' }),
          snippetCardIn({ serial: 1000, stage: 'screening', position: 'Vacancy 1000' }),
          ...cardsIn({ stage: 'screening', count: 39, from: 1001 }),
        ],
      },
      { filters: { q: 'kafka' } },
    );
    await screen.findByRole('heading', { name: 'скринінг 40' });

    expect(within(columnNamed('відгук 1')).getByText('Kafka').tagName).toBe('MARK');
    expect(within(columnNamed('скринінг 40')).getByText('Kafka').tagName).toBe('MARK');
  });
});
