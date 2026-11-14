import type { Page, Route } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { addByPaste, boardAfterParse, parsedSampleCard } from './test/applications';
import { boardCard } from './test/board';
import { expect, test } from './test/session';

const PARSED = parsedSampleCard();

function isJobProgress(url: URL): boolean {
  return url.pathname.startsWith('/api/v1/jobs/') || url.pathname.endsWith('/events/stream');
}

async function holdJobProgress(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isJobProgress, async (route: Route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

test('a pasted vacancy shows its skeleton, is parsed and lands on the board', async ({ page }) => {
  const release = await holdJobProgress(page);

  await addByPaste(page);
  const live = page.getByRole('region', { name: uk.add.explainer.title });
  await expect(live.getByText(uk.application.parsing.queued)).toBeVisible();
  release();

  await boardAfterParse(page);
  await expect(boardCard(page, PARSED)).toBeVisible();
});
