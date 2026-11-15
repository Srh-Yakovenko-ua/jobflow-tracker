import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type BrowserContext, chromium, type Page } from '@playwright/test';
import lighthouse, { type Flags, type RunnerResult } from 'lighthouse';

import { addByHand, uniqueCompany } from './test/applications';
import { SIGNED_IN_PAGES, SIGNED_OUT_PAGES } from './test/routes';
import { expect, register, signedOutTest as test } from './test/session';
import { REPO_ROOT } from './test/stack';

const LIGHTHOUSE_LIMITS = { minScore: 95, port: 9333 } as const;

const SCORE_TITLE = `scores ${String(LIGHTHOUSE_LIMITS.minScore)} or more in accessibility`;

const APPLICATION_ROUTE = '/applications/:id';

type AuditedRoute =
  (typeof SIGNED_OUT_PAGES)[number] | (typeof SIGNED_IN_PAGES)[number] | typeof APPLICATION_ROUTE;

const SCREEN_NAMES: Readonly<Record<AuditedRoute, string>> = {
  '/login': 'login',
  '/register': 'register',
  '/board': 'board',
  '/applications': 'applications',
  '/calendar': 'calendar',
  '/add': 'add',
  '/analytics': 'dashboard',
  '/analytics/summary/2026-10': 'summary',
  '/reminders': 'reminders',
  '/notifications': 'notifications',
  '/resumes': 'resumes',
  '/settings': 'settings',
  [APPLICATION_ROUTE]: 'application',
};

const FLAGS = {
  onlyCategories: ['accessibility'],
  disableStorageReset: true,
  formFactor: 'desktop',
  screenEmulation: { disabled: true },
  throttlingMethod: 'provided',
  logLevel: 'error',
  output: 'json',
} satisfies Flags;

const TSV = {
  file: path.join(REPO_ROOT, 'docs/thesis/data/lighthouse.tsv'),
  header: ['screen', 'route', 'score', 'minimum', 'result'],
} as const;

type Session = {
  port: number;
  context: BrowserContext;
  page: Page;
  profile: string;
  baseURL: string;
  applicationId: string;
};

type ScoreRow = Readonly<{ route: AuditedRoute; score: number }>;

const session: Partial<Session> = {};

const rows: ScoreRow[] = [];

function opened(): Session {
  const { port, context, page, profile, baseURL, applicationId = '' } = session;
  const closed = new Error('the Lighthouse browser is not open');
  if (port === undefined || context === undefined || page === undefined) throw closed;
  if (profile === undefined || baseURL === undefined) throw closed;
  return { port, context, page, profile, baseURL, applicationId };
}

function failingAudits(result: RunnerResult | undefined): string[] {
  return Object.values(result?.lhr.audits ?? {})
    .filter(({ score }) => score !== null && score < 1)
    .map(({ id }) => id);
}

async function audit(route: AuditedRoute): Promise<void> {
  const { port, baseURL, applicationId } = opened();
  const url = new URL(route.replace(':id', applicationId), baseURL).href;
  const result = await lighthouse(url, { ...FLAGS, port });
  const score = Math.round((result?.lhr.categories.accessibility?.score ?? 0) * 100);
  rows.push({ route, score });
  expect(score, failingAudits(result).join(', ')).toBeGreaterThanOrEqual(
    LIGHTHOUSE_LIMITS.minScore,
  );
}

function tsvOf(scores: readonly ScoreRow[]): string {
  const lines = scores.map(({ route, score }) =>
    [
      SCREEN_NAMES[route],
      route,
      score,
      LIGHTHOUSE_LIMITS.minScore,
      score >= LIGHTHOUSE_LIMITS.minScore ? 'PASS' : 'FAIL',
    ].join('\t'),
  );
  return [TSV.header.join('\t'), ...lines, ''].join('\n');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const { baseURL } = test.info().project.use;
  const port = LIGHTHOUSE_LIMITS.port + test.info().parallelIndex;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'jobflow-lighthouse-'));
  const context = await chromium.launchPersistentContext(profile, {
    ...(baseURL === undefined ? {} : { baseURL }),
    locale: 'uk-UA',
    reducedMotion: 'reduce',
    args: [`--remote-debugging-port=${String(port)}`],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  Object.assign(session, { port, context, page, profile, baseURL });
});

test.afterAll(async () => {
  if (rows.length === Object.keys(SCREEN_NAMES).length) await writeFile(TSV.file, tsvOf(rows));
  const { context, profile } = opened();
  await context.close();
  await rm(profile, { recursive: true, force: true });
});

for (const route of SIGNED_OUT_PAGES) {
  test(`${route} ${SCORE_TITLE}`, async () => {
    await audit(route);
  });
}

test('a new user with one application signs in for the signed-in screens', async () => {
  const { page } = opened();
  await register(page);
  session.applicationId = await addByHand(page, {
    company: uniqueCompany('Lighthouse'),
    position: 'Frontend Developer',
  });
});

for (const route of [...SIGNED_IN_PAGES, APPLICATION_ROUTE] as const) {
  test(`${route} ${SCORE_TITLE}`, async () => {
    await audit(route);
  });
}
