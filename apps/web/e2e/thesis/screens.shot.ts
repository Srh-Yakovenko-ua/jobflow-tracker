import path from 'node:path';

import { DEMO_USER } from '@jobflow/shared';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { analyticsBlock, designSankey, resumeAbTable } from '../test/analytics-fixture';
import { boardCards } from '../test/board';
import { type DemoTargets, demoTargets } from '../test/demo';
import { expect, signedOutTest, signIn } from '../test/session';
import { HIDDEN_QUERY_DEVTOOLS, REPO_ROOT } from '../test/stack';

const SCHEMES = ['light', 'dark'] as const;

type Scheme = (typeof SCHEMES)[number];

const VISION_DEFICIENCIES = ['protanopia', 'deuteranopia', 'achromatopsia'] as const;

const VISION_SCREENS = new Set(['board', 'dashboard']);

type Variant = Scheme | (typeof VISION_DEFICIENCIES)[number];

type Detail = Readonly<{ name: string; locate: (page: Page) => Locator }>;

type Screen = Readonly<{
  name: string;
  route: string;
  ready?: (page: Page) => Locator;
  details?: readonly Detail[];
}>;

type Shot = Readonly<{ page: Page; variant: Variant }>;

const SHOTS = {
  dir: path.join(REPO_ROOT, 'docs/screenshots'),
  detailScheme: 'light',
  capture: { animations: 'disabled', style: HIDDEN_QUERY_DEVTOOLS },
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

const shotPath = (name: string, variant: Variant) => path.join(SHOTS.dir, `${name}-${variant}.png`);

async function settle(page: Page, screen: Screen): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(SHOTS.wait);
  if (screen.ready !== undefined) await expect(screen.ready(page)).toBeVisible(SHOTS.wait);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, SHOTS.wait);
}

async function shoot({ page, variant }: Shot, screen: Screen): Promise<void> {
  await page.goto(screen.route);
  await settle(page, screen);
  await page.screenshot({ ...SHOTS.capture, fullPage: true, path: shotPath(screen.name, variant) });
  if (variant !== SHOTS.detailScheme) return;
  for (const detail of screen.details ?? []) {
    await detail
      .locate(page)
      .screenshot({ ...SHOTS.capture, path: shotPath(detail.name, variant) });
  }
}

for (const scheme of SCHEMES) {
  signedOutTest(
    `the thesis screenshots of every screen in ${scheme}`,
    async ({ page, request }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const screen of SIGNED_OUT) {
        await shoot({ page, variant: scheme }, screen);
      }
      await signIn(page, DEMO_USER);
      for (const screen of signedIn(await demoTargets(request))) {
        await shoot({ page, variant: scheme }, screen);
      }
    },
  );
}

signedOutTest(
  'the colour vision screenshots of the board and the dashboard',
  async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: SHOTS.detailScheme });
    await signIn(page, DEMO_USER);
    const screens = signedIn(await demoTargets(request)).filter(({ name }) =>
      VISION_SCREENS.has(name),
    );
    const cdp = await page.context().newCDPSession(page);
    for (const type of VISION_DEFICIENCIES) {
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
      for (const screen of screens) {
        await shoot({ page, variant: type }, screen);
      }
    }
  },
);
