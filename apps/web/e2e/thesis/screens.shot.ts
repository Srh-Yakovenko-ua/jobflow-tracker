import path from 'node:path';

import { applicationListResponseSchema, DEMO_USER, summaryResponseSchema } from '@jobflow/shared';
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { analyticsBlock, designSankey, resumeAbTable } from '../test/analytics-fixture';
import { boardCards } from '../test/board';
import { expect, loginToken, signedOutTest, signIn } from '../test/session';
import { apiUrl, REPO_ROOT } from '../test/stack';

const SCHEMES = ['light', 'dark'] as const;

type Scheme = (typeof SCHEMES)[number];

type Detail = Readonly<{ name: string; locate: (page: Page) => Locator }>;

type Screen = Readonly<{
  name: string;
  route: string;
  ready?: (page: Page) => Locator;
  details?: readonly Detail[];
}>;

type DemoTargets = Readonly<{ applicationId: string; month: string }>;

type Shot = Readonly<{ page: Page; scheme: Scheme }>;

const SHOTS = {
  dir: path.join(REPO_ROOT, 'docs/screenshots'),
  detailScheme: 'light',
  capture: { animations: 'disabled' },
  wait: { timeout: 30_000 },
} as const;

const SIGNED_OUT: readonly Screen[] = [
  { name: 'login', route: '/login' },
  { name: 'register', route: '/register' },
];

function signedIn({ applicationId, month }: DemoTargets): readonly Screen[] {
  return [
    { name: 'board', route: '/board', ready: (page) => boardCards(page).first() },
    { name: 'applications', route: '/applications' },
    { name: 'application', route: `/applications/${applicationId}` },
    { name: 'add', route: '/add' },
    {
      name: 'dashboard',
      route: '/analytics',
      ready: (page) =>
        designSankey(page).getByRole('list', { name: uk.analytics.blocks.sankey.funnel }),
      details: [
        { name: 'method-forecast', locate: (page) => analyticsBlock(page, 'forecast') },
        { name: 'method-sources', locate: (page) => analyticsBlock(page, 'sources') },
      ],
    },
    { name: 'summary', route: `/analytics/summary/${month}` },
    { name: 'calendar', route: '/calendar' },
    { name: 'reminders', route: '/reminders' },
    { name: 'notifications', route: '/notifications' },
    {
      name: 'resumes',
      route: '/resumes',
      ready: resumeAbTable,
      details: [{ name: 'method-resume-ab', locate: resumeAbTable }],
    },
    { name: 'settings', route: '/settings' },
  ];
}

const shotPath = (name: string, scheme: Scheme) => path.join(SHOTS.dir, `${name}-${scheme}.png`);

async function demoTargets(request: APIRequestContext): Promise<DemoTargets> {
  const headers = { Authorization: `Bearer ${await loginToken(request, DEMO_USER)}` };
  const list = await request.get(apiUrl('/applications'), { headers });
  const latest = await request.get(apiUrl('/summaries/latest'), { headers });
  const first = applicationListResponseSchema.parse(await list.json()).items[0];
  const { summary } = summaryResponseSchema.parse(await latest.json());
  if (first === undefined || summary === null) {
    throw new Error('thesis screenshots need the demo data: run pnpm demo:seed first');
  }
  return { applicationId: first.id, month: summary.month };
}

async function settle(page: Page, screen: Screen): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(SHOTS.wait);
  if (screen.ready !== undefined) await expect(screen.ready(page)).toBeVisible(SHOTS.wait);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, SHOTS.wait);
}

async function shoot({ page, scheme }: Shot, screen: Screen): Promise<void> {
  await page.goto(screen.route);
  await settle(page, screen);
  await page.screenshot({ ...SHOTS.capture, fullPage: true, path: shotPath(screen.name, scheme) });
  if (scheme !== SHOTS.detailScheme) return;
  for (const detail of screen.details ?? []) {
    await detail.locate(page).screenshot({ ...SHOTS.capture, path: shotPath(detail.name, scheme) });
  }
}

for (const scheme of SCHEMES) {
  signedOutTest(
    `the thesis screenshots of every screen in ${scheme}`,
    async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const screen of SIGNED_OUT) {
        await shoot({ page, scheme }, screen);
      }
      await signIn(page, DEMO_USER);
      for (const screen of signedIn(await demoTargets(request))) {
        await shoot({ page, scheme }, screen);
      }
    },
  );
}
