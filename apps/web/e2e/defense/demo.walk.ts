import path from 'node:path';

import { AI_JOB_STEPS, DEMO_USER, REJECTION_REASONS } from '@jobflow/shared';
import type { BrowserContext, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { COPY_UK } from '../../../../bookmarklet/src/copy-uk';
import { analyticsBlock, designSankey, resumeAbTable } from '../test/analytics-fixture';
import { parsedSampleCard } from '../test/applications';
import { boardCard, boardCards, keyboardMove, stageColumn } from '../test/board';
import { bookmarkletCode } from '../test/bookmarklet';
import { demoTargets } from '../test/demo';
import { reloadUntilVisible } from '../test/reload';
import { expect, signedOutTest, signIn } from '../test/session';
import { HIDDEN_QUERY_DEVTOOLS, REPO_ROOT, WORKER_WAIT } from '../test/stack';

type Capture = Readonly<{ code: string; vacancy: string }>;

const VACANCY = {
  origin: 'http://127.0.0.1:8090',
  parsed: '/vacancy.html',
  failed: '/vacancy-failed.html',
} as const;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

const VIDEO_PATH = path.join(REPO_ROOT, 'docs/thesis/build/defense/demo.webm');

const CAPTURED = parsedSampleCard();

const PARSING = uk.application.parsing;

const PROCESSING_LINE = PARSING.processing(AI_JOB_STEPS.processing, AI_JOB_STEPS.total);

const FOLLOWUP = uk.followup;

const REJECT = uk.board.reject;

async function recordLeaks(context: BrowserContext): Promise<string[]> {
  const leaks: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (LOOPBACK_HOSTS.has(url.hostname)) {
      await route.fallback();
      return;
    }
    leaks.push(url.href);
    await route.abort('internetdisconnected');
  });
  return leaks;
}

async function hideQueryDevtools(context: BrowserContext): Promise<void> {
  await context.addInitScript((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, HIDDEN_QUERY_DEVTOOLS);
}

async function capture(page: Page, { code, vacancy }: Capture): Promise<void> {
  await page.goto(`${VACANCY.origin}${vacancy}`);
  await page.evaluate(code);
  await expect(page.locator('jobflow-toast').getByRole('status')).toContainText(COPY_UK.added);
}

async function watchParse(page: Page): Promise<void> {
  await page.goto('/board');
  const main = page.getByRole('main');
  await expect(
    main.getByText(PARSING.queued).or(main.getByText(PROCESSING_LINE)).first(),
  ).toBeVisible();
  await expect(boardCard(page, CAPTURED)).toBeVisible(WORKER_WAIT);
}

async function watchFailure(page: Page, code: string): Promise<void> {
  await capture(page, { code, vacancy: VACANCY.failed });
  await page.goto('/board');
  await expect(boardCards(page).filter({ hasText: PARSING.failed })).toBeVisible(WORKER_WAIT);
}

async function draftFollowup(page: Page): Promise<void> {
  await page.goto('/board');
  await boardCard(page, CAPTURED).click();
  const panel = page.getByRole('region', { name: FOLLOWUP.kicker });
  await panel.getByRole('button', { name: FOLLOWUP.generate }).click();
  await expect(panel.getByRole('button', { name: FOLLOWUP.markSent })).toBeVisible(WORKER_WAIT);
}

async function rejectForSkillsGap(page: Page): Promise<void> {
  await page.goto('/board');
  await keyboardMove(page, { card: CAPTURED, stage: 'rejected' });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: REJECTION_REASONS.skills_gap.labelUk }).click();
  await expect(dialog.getByText(REJECT.saved.eyebrow)).toBeVisible();
  await dialog.getByRole('button', { name: REJECT.saved.done }).click();
  const rejected = stageColumn(page, 'rejected');
  await rejected.getByRole('heading', { level: 2 }).getByRole('button').click();
  await expect(rejected.getByRole('link').filter({ hasText: CAPTURED.company })).toBeVisible();
}

async function showResults(page: Page, month: string): Promise<void> {
  await page.goto('/analytics');
  const funnel = uk.analytics.blocks.sankey.funnel;
  await reloadUntilVisible(page, designSankey(page, 1).getByRole('list', { name: funnel }));
  await analyticsBlock(page, 'forecast').scrollIntoViewIfNeeded();
  await expect(analyticsBlock(page, 'forecast')).toBeInViewport();
  await page.goto('/resumes');
  await expect(resumeAbTable(page)).toBeVisible();
  await page.goto(`/analytics/summary/${month}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

async function saveRecording(page: Page): Promise<void> {
  const video = page.video();
  if (video === null) throw new Error('the defense walk records with video on');
  await page.close();
  await video.saveAs(VIDEO_PATH);
}

signedOutTest(
  'the defense demo runs beat by beat on loopback only',
  async ({ context, page, request }) => {
    const leaks = await recordLeaks(context);
    await hideQueryDevtools(context);
    const { month } = await demoTargets(request);
    await signIn(page, DEMO_USER);
    const code = await bookmarkletCode(page);

    await capture(page, { code, vacancy: VACANCY.parsed });
    await watchParse(page);
    await watchFailure(page, code);
    await draftFollowup(page);
    await rejectForSkillsGap(page);
    await showResults(page, month);

    await saveRecording(page);
    expect(leaks).toEqual([]);
  },
);
