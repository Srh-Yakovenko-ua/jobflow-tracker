import {
  buildDesignFunnel,
  buildDesignReasons,
  buildDesignSankey,
  buildDesignSources,
  buildDesignTimings,
  buildFoldedSankey,
  buildForecast,
  designInsightsBody,
} from '@jobflow/shared/testing';
import type { Page, Route } from '@playwright/test';

import { ANALYTICS_ORIGIN } from './stack';

type DesignReply = (url: URL) => unknown;

const DESIGN_REPLIES: Readonly<Record<string, DesignReply>> = {
  '/analytics/funnel': () => buildDesignFunnel(),
  '/analytics/sankey': (url) =>
    url.searchParams.get('split') === 'reason' ? buildFoldedSankey() : buildDesignSankey(),
  '/analytics/reasons': () => buildDesignReasons(),
  '/analytics/sources': () => buildDesignSources(),
  '/analytics/timings': () => buildDesignTimings(),
  '/analytics/forecast': () => buildForecast(),
  '/analytics/insights': () => designInsightsBody(),
};

async function replyWithDesign(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const reply = DESIGN_REPLIES[url.pathname];
  if (reply === undefined) {
    await route.fallback();
    return;
  }
  await route.fulfill({ json: reply(url) });
}

export async function routeDesignAnalytics(page: Page): Promise<void> {
  await page.route(`${ANALYTICS_ORIGIN}/analytics/**`, replyWithDesign);
}
