import { type Stage, STAGE_LABELS, STAGES } from '@jobflow/shared';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import type { HandCard } from './applications';
import { expect } from './session';

export type CardMove = Readonly<{ card: HandCard; stage: Stage }>;

type ArrowWalk = Readonly<{ page: Page; live: Locator; target: string; stepsLeft: number }>;

const A11Y = uk.board.move.a11y;

export function boardCard(page: Page, card: HandCard): Locator {
  return page.locator(`a[aria-roledescription="${A11Y.roleDescription}"]`).filter({
    hasText: card.company,
  });
}

export function stageColumn(page: Page, stage: Stage): Locator {
  return page.locator('section[data-drop]').filter({
    has: page.getByRole('heading', { level: 2, name: STAGE_LABELS[stage].labelUk }),
  });
}

async function walkRight(walk: ArrowWalk): Promise<void> {
  expect(walk.stepsLeft).toBeGreaterThan(0);
  const before = (await walk.live.textContent()) ?? '';
  await walk.page.keyboard.press('ArrowRight');
  await expect(walk.live).not.toHaveText(before);
  if ((await walk.live.textContent()) === walk.target) return;
  await walkRight({ ...walk, stepsLeft: walk.stepsLeft - 1 });
}

export async function keyboardMove(page: Page, { card, stage }: CardMove): Promise<void> {
  const live = page.locator('[id^="DndLiveRegion"]');
  await boardCard(page, card).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(uk.board.move.keyboardHint.picked)).toBeVisible();
  const target = A11Y.over({ position: card.position, stage: STAGE_LABELS[stage].labelUk });
  await walkRight({ page, live, target, stepsLeft: STAGES.length });
  await page.keyboard.press('Space');
}
