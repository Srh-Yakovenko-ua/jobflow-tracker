import { describe, expect, it } from 'vitest';

import { boardDensityFromCookie } from './board-density-cookie';
import { createBoardDensityStore } from './board-density-store';

describe('boardDensityFromCookie', () => {
  it.each([
    ['compact', 'compact'],
    ['full', 'full'],
    [undefined, 'full'],
    ['dense', 'full'],
    ['garbage', 'full'],
  ])('reads %s as the %s board', (value, density) => {
    expect(boardDensityFromCookie(value)).toEqual({ density });
  });
});

describe('createBoardDensityStore', () => {
  it('switches the board to compact cards and remembers it in the cookie, then back to full', () => {
    const store = createBoardDensityStore({ density: 'full' });

    store.getState().setDensity('compact');
    expect(store.getState().density).toBe('compact');
    expect(document.cookie).toContain('jobflow_board_density=compact');

    store.getState().setDensity('full');
    expect(store.getState().density).toBe('full');
    expect(document.cookie).toContain('jobflow_board_density=full');
  });
});
