import { screen, within } from '@testing-library/react';

import type { renderBoard } from './render-board';

export const CHIPS_NAME = 'Активні фільтри';

type BoardUser = ReturnType<typeof renderBoard>['user'];

export type PillPick = Readonly<{ pill: string; option: string }>;

export function searchField(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Пошук по картках' });
}

export function chipNames(): (string | null)[] {
  const chips = within(screen.getByRole('list', { name: CHIPS_NAME }));
  return chips.getAllByRole('listitem').map((chip) => chip.textContent);
}

export async function pickInPill(user: BoardUser, { pill, option }: PillPick) {
  await user.click(await screen.findByRole('button', { name: pill }));
  await user.click(await screen.findByRole('checkbox', { name: option }));
  await user.keyboard('{Escape}');
}

export function pickSource(user: BoardUser) {
  return pickInPill(user, { pill: 'Джерело: усі', option: 'Djinni' });
}
