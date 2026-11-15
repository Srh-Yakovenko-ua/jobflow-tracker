import type { InsightsResponse } from '@jobflow/shared';
import {
  buildDesignFunnel,
  buildDesignMatchValidation,
  buildDesignReasons,
  buildDesignResumeAb,
  buildDesignSalary,
  buildDesignSankey,
  buildDesignSources,
  buildDesignTimings,
  buildFoldedSankey,
  buildForecast,
  designInsightsBody,
} from '@jobflow/shared/testing';
import type { Locator, Page, Route } from '@playwright/test';

import { uk } from '@/shared/i18n';
import { ANALYTICS_ANCHORS, type AnalyticsBlock } from '@/shared/lib/analytics-anchors';

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
  '/analytics/salary': () => buildDesignSalary(),
  '/analytics/resume-ab': () => buildDesignResumeAb(),
  '/analytics/match-validation': () => buildDesignMatchValidation(),
};

export type DesignOverrides = Readonly<{ insights?: InsightsResponse }>;

async function replyFrom(route: Route, replies: Readonly<Record<string, DesignReply>>) {
  const url = new URL(route.request().url());
  const reply = replies[url.pathname];
  if (reply === undefined) {
    await route.fallback();
    return;
  }
  await route.fulfill({ json: reply(url) });
}

function repliesWith({ insights }: DesignOverrides): Readonly<Record<string, DesignReply>> {
  return insights === undefined
    ? DESIGN_REPLIES
    : { ...DESIGN_REPLIES, '/analytics/insights': () => insights };
}

export async function routeDesignAnalytics(
  page: Page,
  overrides: DesignOverrides = {},
): Promise<void> {
  const replies = repliesWith(overrides);
  await page.route(`${ANALYTICS_ORIGIN}/analytics/**`, (route) => replyFrom(route, replies));
}

export function analyticsBlock(page: Page, block: AnalyticsBlock): Locator {
  return page.locator(`#${ANALYTICS_ANCHORS[block]}`);
}

export function resumeAbTable(page: Page): Locator {
  return page.getByRole('table', { name: uk.resumes.title, exact: true });
}

export function designSankey(page: Page, addedApplications = 0): Locator {
  return page.getByRole('region', {
    name: uk.analytics.blocks.sankey.title(buildDesignFunnel().kpis.sent.total + addedApplications),
  });
}
