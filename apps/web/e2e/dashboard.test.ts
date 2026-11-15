import { designInsightsBody } from '@jobflow/shared/testing';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { designSankey, routeDesignAnalytics } from './test/analytics-fixture';
import { seriousViolations } from './test/axe';
import { expect, test } from './test/session';

const BLOCKS = uk.analytics.blocks;

const INSIGHTS = designInsightsBody();

const SCHEMES = ['light', 'dark'] as const;

async function openDesignDashboard(page: Page): Promise<Locator> {
  await routeDesignAnalytics(page);
  await page.goto('/analytics');
  const sankey = designSankey(page);
  await expect(sankey.getByRole('list', { name: BLOCKS.sankey.funnel })).toBeVisible();
  return sankey;
}

test('the dashboard shows the funnel, the offer forecast and the insight headlines', async ({
  page,
}) => {
  const sankey = await openDesignDashboard(page);
  await expect(sankey.getByRole('table', { name: BLOCKS.sankey.table.caption })).toBeAttached();

  const forecast = page.getByRole('region', { name: BLOCKS.forecast.eyebrow });
  await expect(forecast.getByRole('button', { name: BLOCKS.forecast.method.label })).toBeVisible();
  await expect(forecast.getByText(BLOCKS.forecast.tech)).toBeVisible();
  const notes = page.getByRole('group', { name: BLOCKS.sankey.notes.label });
  const funnelInsights = INSIGHTS.insights.filter(({ block }) => block === 'funnel');
  for (const { title } of funnelInsights) {
    await expect(notes.getByText(BLOCKS.sankey.notes.lead(title))).toBeVisible();
  }
  const actions = page.getByRole('list', { name: uk.analytics.whatToDo.list });
  for (const { title } of INSIGHTS.actions) {
    await expect(actions.getByText(title)).toBeVisible();
  }
});

for (const colorScheme of SCHEMES) {
  test(`the dashboard with its charts drawn has no serious axe violations in ${colorScheme} and the funnel table opens`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    const sankey = await openDesignDashboard(page);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    await sankey.getByRole('button', { name: uk.ui.showTable }).click();
    await expect(sankey.getByRole('button', { name: uk.ui.hideTable })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(sankey.getByRole('table', { name: BLOCKS.sankey.table.caption })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
}
