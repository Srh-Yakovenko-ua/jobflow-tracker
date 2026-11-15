import { chmodSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { DOCS_PATHS, inRepo } from './paths.js';
import { run } from './run.js';
import { gitleaksCount, trivyCounts, zapCounts } from './snapshots.js';

export const SCANNER_IMAGES = {
  trivy:
    'aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb',
  zap: 'ghcr.io/zaproxy/zaproxy:2.17.0@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af',
  gitleaks:
    'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
};

const SCAN_RULES = {
  services: ['api', 'web', 'analytics', 'ai', 'documents'],
  trivyEverything: [
    '--severity',
    'UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL',
    '--ignore-unfixed=false',
    '--exit-code',
    '0',
    '--format',
    'json',
  ],
  zapTargets: [
    { name: 'web', url: 'http://localhost:3000' },
    { name: 'api', url: 'http://localhost:4000/api/v1/health' },
  ],
  zapOkCodes: [0, 2],
  gitleaksOkCodes: [0, 1],
  gitSafeDirectory: [
    'GIT_CONFIG_COUNT=1',
    'GIT_CONFIG_KEY_0=safe.directory',
    'GIT_CONFIG_VALUE_0=*',
  ],
  screenshot: `${DOCS_PATHS.screenshots}/zap-report.png`,
  viewport: { width: 1280, height: 1400 },
};

const imageTag = (service) => `jobflow-${service}:ci`;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const dockerRun = ({ args, okCodes = [0] }) =>
  run({ command: 'docker', args: ['run', '--rm', ...args], okCodes });

export function requireImages() {
  const tags = SCAN_RULES.services.map(imageTag);
  const missing = tags.filter(
    (tag) => run({ command: 'docker', args: ['images', '-q', tag] }).trim() === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `docs:data security scans the prod images ${tags.join(', ')}; missing ${missing.join(', ')}. Build them with the README quick start (README.md#швидкий-старт).`,
    );
  }
}

function exportHead(scratch) {
  const archive = path.join(scratch, 'head.tar');
  const tree = path.join(scratch, 'head');
  mkdirSync(tree);
  run({ command: 'git', args: ['archive', '--format=tar', '-o', archive, 'HEAD'] });
  run({ command: 'tar', args: ['-xf', archive, '-C', tree] });
  return tree;
}

function trivy({ scratch, tree }, { mounts = [], args }) {
  const cache = path.join(scratch, 'trivy-cache');
  mkdirSync(cache, { recursive: true });
  const report = dockerRun({
    args: [
      ...['-v', `${cache}:/root/.cache/trivy`, '-v', `${tree}:/src`, '-w', '/src', ...mounts],
      SCANNER_IMAGES.trivy,
      ...args,
      ...SCAN_RULES.trivyEverything,
    ],
  });
  return trivyCounts(JSON.parse(report));
}

function trivyScans(scan) {
  const repository = trivy(scan, { args: ['fs', '--scanners', 'vuln,secret,misconfig', '.'] });
  const socket = ['-v', '/var/run/docker.sock:/var/run/docker.sock'];
  return [
    { scanner: 'Trivy fs', target: 'репозиторій, git archive HEAD', ...repository },
    ...SCAN_RULES.services.map((service) => ({
      scanner: 'Trivy image',
      target: imageTag(service),
      ...trivy(scan, { mounts: socket, args: ['image', '--scanners', 'vuln', imageTag(service)] }),
    })),
  ];
}

function gitleaks({ scratch, tree }) {
  const gitDir = run({
    command: 'git',
    args: ['rev-parse', '--path-format=absolute', '--git-common-dir'],
  }).trim();
  const out = path.join(scratch, 'gitleaks');
  mkdirSync(out);
  const { uid, gid } = os.userInfo();
  dockerRun({
    args: [
      ...['--user', `${String(uid)}:${String(gid)}`],
      ...SCAN_RULES.gitSafeDirectory.flatMap((variable) => ['-e', variable]),
      ...['-v', `${gitDir}:/repo:ro`, '-v', `${tree}/.gitleaks.toml:/config.toml:ro`],
      ...['-v', `${out}:/out`, SCANNER_IMAGES.gitleaks, 'git', '/repo', '--config', '/config.toml'],
      ...[
        '--redact',
        '--no-banner',
        '--report-format',
        'json',
        '--report-path',
        '/out/report.json',
      ],
    ],
    okCodes: SCAN_RULES.gitleaksOkCodes,
  });
  const findings = gitleaksCount(readJson(path.join(out, 'report.json')));
  return { scanner: 'gitleaks', target: 'історія git, усі гілки', findings };
}

function zap({ work, tree }) {
  mkdirSync(work);
  chmodSync(work, 0o777);
  copyFileSync(path.join(tree, '.zap/rules.tsv'), path.join(work, 'rules.tsv'));
  return SCAN_RULES.zapTargets.map(({ name, url }) => {
    dockerRun({
      args: [
        ...[
          '--network',
          'host',
          '-v',
          `${work}:/zap/wrk:rw`,
          SCANNER_IMAGES.zap,
          'zap-baseline.py',
        ],
        ...['-t', url, '-c', 'rules.tsv', '-r', `zap-${name}.html`, '-J', `zap-${name}.json`],
        ...['-I', '-m', '1', '-T', '10'],
      ],
      okCodes: SCAN_RULES.zapOkCodes,
    });
    const counts = zapCounts(readJson(path.join(work, `zap-${name}.json`)));
    return { scanner: 'OWASP ZAP baseline', target: url, ...counts };
  });
}

async function renderZapReport(work) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: SCAN_RULES.viewport });
    await page.goto(pathToFileURL(path.join(work, 'zap-web.html')).href);
    await page.screenshot({ path: inRepo(SCAN_RULES.screenshot) });
  } finally {
    await browser.close();
  }
}

export async function measureSecurityScans(scratch) {
  const tree = exportHead(scratch);
  const work = path.join(scratch, 'zap');
  const scans = [
    ...trivyScans({ scratch, tree }),
    gitleaks({ scratch, tree }),
    ...zap({ work, tree }),
  ];
  await renderZapReport(work);
  return scans;
}
