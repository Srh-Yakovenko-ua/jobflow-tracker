import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

import type { Latch } from './latch';

export type HeldDoubleClick = Readonly<{
  user: UserEvent;
  held: Latch;
  click: string;
  sent: readonly unknown[];
  disabledWhileHeld: readonly string[];
}>;

function enabledButtonsOf(names: readonly string[]): string[] {
  return names.filter((name) => !screen.getByRole<HTMLButtonElement>('button', { name }).disabled);
}

export async function doubleClickWhileHeld({
  user,
  held,
  click,
  sent,
  disabledWhileHeld,
}: HeldDoubleClick): Promise<void> {
  await user.dblClick(screen.getByRole('button', { name: click }));
  await waitFor(() => {
    expect(sent).toHaveLength(1);
  });
  expect(enabledButtonsOf(disabledWhileHeld)).toEqual([]);
  held.release();
}
