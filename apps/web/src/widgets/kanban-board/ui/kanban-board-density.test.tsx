import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { clearCookie } from '@/shared/lib/cookie';
import { startDrag } from '@/test/board-drag';
import { boardRoute, DESIGN_BOARD } from '@/test/board-fixtures';
import { boardReadyToDrag, renderBoard } from '@/test/render-board';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { BOARD_DENSITY_COOKIE } from '../model/board-density-cookie';
import { KanbanBoard } from './kanban-board';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const DENSITY = uk.board.density;

const DRAGGED = 'Senior Frontend Engineer';

function densityChoice(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

afterEach(() => {
  clearCookie(BOARD_DENSITY_COOKIE);
  vi.restoreAllMocks();
});

describe('KanbanBoard card density', () => {
  it('«Щільні» drops the stack and its +N from every card, remembers the choice in the cookie, and the dragged copy is dense too', async () => {
    const { user } = await boardReadyToDrag();
    expect(screen.getByRole('radiogroup', { name: DENSITY.label })).toBeDefined();
    expect(screen.getAllByText('React')).toHaveLength(4);
    expect(screen.getAllByText('+2')).toHaveLength(4);

    await user.click(densityChoice(DENSITY.compact));

    expect(densityChoice(DENSITY.compact).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryAllByText('React')).toEqual([]);
    expect(screen.queryAllByText('+2')).toEqual([]);
    expect(document.cookie).toContain('jobflow_board_density=compact');
    const drag = startDrag(screen.getByText(DRAGGED));
    expect(screen.getAllByText(DRAGGED)).toHaveLength(2);
    expect(screen.queryAllByText('React')).toEqual([]);
    drag.cancel();
  });

  it('a board opened with the compact cookie draws dense cards from its first paint, «Щільні» picked', async () => {
    server.use(meRoute(), boardRoute(DESIGN_BOARD).handler);
    renderInApp(<KanbanBoard initial={{ density: 'compact' }} />);
    await screen.findByText(DRAGGED);

    expect(screen.queryAllByText('React')).toEqual([]);
    expect(densityChoice(DENSITY.compact).getAttribute('aria-checked')).toBe('true');
    expect(densityChoice(DENSITY.full).getAttribute('aria-checked')).toBe('false');
  });

  it('the first run board has no density switch', async () => {
    renderBoard({ counts: {} });
    await screen.findByRole('heading', { name: uk.board.firstRun.title });

    expect(screen.queryByRole('radiogroup', { name: DENSITY.label })).toBeNull();
  });
});
