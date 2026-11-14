import { designInsightsBody } from '@jobflow/shared/testing';

import { uk } from '@/shared/i18n';

import { designSankey, routeDesignAnalytics } from './test/analytics-fixture';
import { expect, test } from './test/session';

const BLOCKS = uk.analytics.blocks;

const INSIGHTS = designInsightsBody();

test('the dashboard shows the funnel, the offer forecast and the insight headlines', async ({
  page,
}) => {
  await routeDesignAnalytics(page);
  await page.goto('/analytics');

  const sankey = designSankey(page);
  await expect(sankey.getByRole('list', { name: BLOCKS.sankey.funnel })).toBeVisible();
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
