import { screen, within } from '@testing-library/react';

import type { renderBoard } from './render-board';

export const CHIPS_NAME = 'Активні фільтри';

export function searchField(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Пошук по картках' });
}

export function chipNames(): (string | null)[] {
  const chips = within(screen.getByRole('list', { name: CHIPS_NAME }));
  return chips.getAllByRole('listitem').map((chip) => chip.textContent);
}

export async function pickSource(user: ReturnType<typeof renderBoard>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Джерело: усі' }));
  await user.click(screen.getByRole('checkbox', { name: 'Djinni' }));
  await user.keyboard('{Escape}');
}
