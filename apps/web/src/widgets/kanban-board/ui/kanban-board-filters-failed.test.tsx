import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickSource, searchField } from '@/test/board-filters';
import { DESIGN_BOARD } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { columnNamed, renderBoard } from '@/test/render-board';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const RETRY = 'Спробувати ще раз';

const SETTLED = { timeout: 2500 };

const DEFAULT_GC_TIME_MS = 5 * 60_000;

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

function renderFailingSource() {
  return renderBoard({ ...DESIGN_BOARD, failFor: ['source'] });
}

async function boardAfterFailedSource() {
  const rendered = renderFailingSource();
  await pickSource(rendered.user);
  await screen.findByRole('alert', {}, SETTLED);
  return rendered;
}

function busyOfFrameWith(heading: string): string | null | undefined {
  return screen
    .getByRole('heading', { name: heading })
    .closest('[aria-busy]')
    ?.getAttribute('aria-busy');
}

describe('KanbanBoard while a filter request fails', () => {
  it('opening a strip the last board did not hold leaves the toolbar alert as the one failure report', async () => {
    const { user } = await boardAfterFailedSource();

    await user.click(screen.getByRole('button', { name: 'відмова 32' }));
    await waitFor(() => {
      expect(columnNamed('відмова 32').getAttribute('aria-busy')).toBe('false');
    }, SETTLED);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: RETRY })).toHaveLength(1);
  });

  it('the last board stays with its toolbar after the cache time passes on a filter that keeps failing', async () => {
    fakeTimeouts();
    const { user, sent } = await boardAfterFailedSource();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_GC_TIME_MS + 1);
    });
    await user.click(screen.getByRole('button', { name: RETRY }));
    await waitFor(() => {
      expect(sent).toEqual([
        '',
        'source=djinni',
        'source=djinni',
        'source=djinni',
        'source=djinni',
      ]);
    }, SETTLED);
    await screen.findByRole('alert', {}, SETTLED);

    expect(screen.getByRole('heading', { name: 'відгук 2' })).toBeDefined();
    expect(searchField()).toBeDefined();
  });

  it('the board frame is busy while a filter request or its retry is in flight and not once it has failed', async () => {
    const { user, sent } = renderFailingSource();
    await pickSource(user);
    await waitFor(() => {
      expect(sent).toEqual(['', 'source=djinni']);
    });

    expect(busyOfFrameWith('відгук 2')).toBe('true');
    await screen.findByRole('alert', {}, SETTLED);
    expect(busyOfFrameWith('відгук 2')).toBe('false');

    await user.click(screen.getByRole('button', { name: RETRY }));
    await waitFor(() => {
      expect(busyOfFrameWith('відгук 2')).toBe('true');
    });
    await screen.findByRole('alert', {}, SETTLED);
    expect(busyOfFrameWith('відгук 2')).toBe('false');
  });
});
