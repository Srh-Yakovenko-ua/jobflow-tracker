import type { Page, Route } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { addByPaste, confirmParsed, parsedSampleCard } from './test/applications';
import { boardCard } from './test/board';
import { expect, test } from './test/session';
import { WORKER_WAIT } from './test/stack';

const PARSED = parsedSampleCard();

const FIELDS = uk.add.manual.fields;

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

test('a pasted vacancy shows its skeleton, is reviewed and lands on the board', async ({
  page,
}) => {
  const release = await holdJobProgress(page);

  await addByPaste(page);
  const live = page.getByRole('region', { name: uk.add.explainer.title });
  await expect(live.getByText(uk.application.parsing.queued)).toBeVisible();
  release();

  const review = page.getByRole('form', { name: uk.add.review.title });
  await expect(review.getByRole('textbox', { name: FIELDS.company })).toHaveValue(
    PARSED.company,
    WORKER_WAIT,
  );
  await expect(review.getByRole('textbox', { name: FIELDS.position })).toHaveValue(PARSED.position);
  await confirmParsed(page);

  await expect(boardCard(page, PARSED)).toBeVisible();
});
