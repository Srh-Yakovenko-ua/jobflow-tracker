import { DEMO_USER } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { designSankey } from './test/analytics-fixture';
import { expect, signedOutTest, signIn } from './test/session';

signedOutTest('the demo account sees its seeded funnel on the dashboard', async ({ page }) => {
  await signIn(page, DEMO_USER);
  await page.goto('/analytics');

  const funnel = uk.analytics.blocks.sankey.funnel;
  await expect(designSankey(page).getByRole('list', { name: funnel })).toBeVisible();
});
