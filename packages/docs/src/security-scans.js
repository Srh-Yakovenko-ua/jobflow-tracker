import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { DOCS_PATHS, inRepo } from './paths.js';
import { run } from './run.js';
import { gitleaksCount, sarifCounts, zapCounts } from './snapshots.js';

export const SCANNER_IMAGES = {
  gitleaks:
    'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
};

const SCAN_RULES = {
  runList: [
    ...['run', 'list', '--workflow', 'security.yml', '--branch', 'main'],
    ...['--status', 'success', '--limit', '20', '--json', 'databaseId'],
  ],
  artifacts: { trivy: 'trivy-sarif', zap: 'zap-report' },
  trivyTargets: [
    { report: 'fs', scanner: 'Trivy fs', target: 'репозиторій, main' },
    ...['api', 'web', 'analytics', 'ai', 'documents'].map((service) => ({
      report: service,
      scanner: 'Trivy image',
      target: `jobflow-${service}:ci`,
    })),
  ],
  zapTargets: [
    { name: 'web', url: 'http://localhost:3000' },
    { name: 'api', url: 'http://localhost:4000/api/v1/health' },
  ],
  gitleaksOkCodes: [0, 1],
  gitSafeDirectory: [
    'GIT_CONFIG_COUNT=1',
    'GIT_CONFIG_KEY_0=safe.directory',
    'GIT_CONFIG_VALUE_0=*',
  ],
  screenshot: `${DOCS_PATHS.screenshots}/zap-report.png`,
  viewport: { width: 1280, height: 1400 },
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const gh = (args) => run({ command: 'gh', args });

function hasScanArtifacts(runId) {
  const names = gh([
    'api',
    `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`,
    '--jq',
    '.artifacts[] | select(.expired | not) | .name',
  ]).split('\n');
  return Object.values(SCAN_RULES.artifacts).every((name) => names.includes(name));
}

function latestScanRun() {
  const runId = JSON.parse(gh(SCAN_RULES.runList))
    .map(({ databaseId }) => String(databaseId))
    .find(hasScanArtifacts);
  if (runId === undefined) {
    throw new Error(
      `No successful Security run on main among the last 20 keeps both ${Object.values(SCAN_RULES.artifacts).join(' and ')}`,
    );
  }
  return runId;
}

function downloadArtifacts(scratch) {
  const dir = path.join(scratch, 'artifacts');
  const names = Object.values(SCAN_RULES.artifacts).flatMap((name) => ['-n', name]);
  gh(['run', 'download', latestScanRun(), ...names, '-D', dir]);
  return {
    trivy: path.join(dir, SCAN_RULES.artifacts.trivy),
    zap: path.join(dir, SCAN_RULES.artifacts.zap),
  };
}

const trivyScans = (dir) =>
  SCAN_RULES.trivyTargets.map(({ report, scanner, target }) => ({
    scanner,
    target,
    ...sarifCounts(readJson(path.join(dir, `trivy-${report}.sarif`))),
  }));

const zapScans = (dir) =>
  SCAN_RULES.zapTargets.map(({ name, url }) => ({
    scanner: 'OWASP ZAP baseline',
    target: url,
    ...zapCounts(readJson(path.join(dir, `zap-${name}.json`))),
  }));

function gitleaks(scratch) {
  const gitDir = run({
    command: 'git',
    args: ['rev-parse', '--path-format=absolute', '--git-common-dir'],
  }).trim();
  const out = path.join(scratch, 'gitleaks');
  mkdirSync(out);
  const { uid, gid } = os.userInfo();
  run({
    command: 'docker',
    args: [
      ...['run', '--rm', '--user', `${String(uid)}:${String(gid)}`],
      ...SCAN_RULES.gitSafeDirectory.flatMap((variable) => ['-e', variable]),
      ...['-v', `${gitDir}:/repo:ro`, '-v', `${inRepo('.gitleaks.toml')}:/config.toml:ro`],
      ...['-v', `${out}:/out`, SCANNER_IMAGES.gitleaks, 'git', '/repo', '--config', '/config.toml'],
      ...['--redact', '--no-banner', '--report-format', 'json'],
      ...['--report-path', '/out/report.json'],
    ],
    okCodes: SCAN_RULES.gitleaksOkCodes,
  });
  const findings = gitleaksCount(readJson(path.join(out, 'report.json')));
  return { scanner: 'gitleaks', target: 'історія git, усі гілки', findings };
}

async function renderZapReport(dir) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: SCAN_RULES.viewport });
    await page.goto(pathToFileURL(path.join(dir, 'zap-web.html')).href);
    await page.screenshot({ path: inRepo(SCAN_RULES.screenshot) });
  } finally {
    await browser.close();
  }
}

export async function measureSecurityScans(scratch) {
  const artifacts = downloadArtifacts(scratch);
  const scans = [...trivyScans(artifacts.trivy), gitleaks(scratch), ...zapScans(artifacts.zap)];
  await renderZapReport(artifacts.zap);
  return scans;
}
