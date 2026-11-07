import type { ApplicationFilters } from '@jobflow/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chipNames, CHIPS_NAME, searchField } from '@/test/board-filters';
import { DESIGN_BOARD } from '@/test/board-fixtures';
import { navigateTo, route } from '@/test/navigation';
import { renderBoard } from '@/test/render-board';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const FILTERED: ApplicationFilters = { source: ['djinni'], stage: ['screening'] };

afterEach(() => {
  window.history.replaceState(null, '', '/');
  route.pathname = '/board';
});

describe('KanbanBoard filters in step with the URL', () => {
  it('Back to a filtered URL over stale page props shows its chips and columns and asks for its filters', async () => {
    const { sent } = renderBoard(DESIGN_BOARD, { url: '/board?source=djinni&stage=screening' });

    expect(await screen.findByRole('heading', { name: 'скринінг 1' })).toBeDefined();
    expect(chipNames()).toEqual(['джерело: Djinni', 'етап: скринінг']);
    expect(screen.getByRole('button', { name: 'Джерело: Djinni' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'відгук 2' })).toBeNull();
    await waitFor(() => {
      expect(sent.at(-1)).toBe('source=djinni');
    });
  });

  it('the Дошка link to the bare board drops every chip and shows the whole board', async () => {
    renderBoard(DESIGN_BOARD, { filters: FILTERED });
    await screen.findByRole('heading', { name: 'скринінг 1' });

    act(() => {
      navigateTo('/board');
    });

    expect(screen.queryByRole('list', { name: CHIPS_NAME })).toBeNull();
    expect(screen.getByRole('button', { name: 'Джерело: усі' })).toBeDefined();
    expect(await screen.findByRole('heading', { name: 'відгук 2' })).toBeDefined();
    expect(window.location.search).toBe('');
  });

  it('a card sheet opened over the board keeps its chips', async () => {
    renderBoard(DESIGN_BOARD, { filters: FILTERED });
    await screen.findByRole('heading', { name: 'скринінг 1' });

    act(() => {
      navigateTo('/applications/a1');
    });

    expect(chipNames()).toEqual(['джерело: Djinni', 'етап: скринінг']);
    expect(screen.getByRole('heading', { name: 'скринінг 1' })).toBeDefined();
  });

  it('a space typed between two words stays in the search field', async () => {
    const { user } = renderBoard(DESIGN_BOARD);
    await screen.findByRole('heading', { name: 'відгук 2' });

    await user.type(searchField(), 'senior dev');

    expect(searchField().value).toBe('senior dev');
    expect(window.location.search).toBe('?q=senior+dev');
  });
});
