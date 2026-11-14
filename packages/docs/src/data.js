import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { measureCoverage } from './coverage.js';
import { DOCS_PATHS, inRepo } from './paths.js';
import { run } from './run.js';
import { auditCounts, e2eTests, evalProblem } from './snapshots.js';

const WEB_URL = process.env.THESIS_WEB_URL ?? 'http://localhost:3000';

const DATA_RULES = {
  evalKinds: ['vacancy', 'resume', 'match', 'followup'],
  probeTimeoutMs: 3000,
  services: [
    { name: 'ai', url: 'http://127.0.0.1:8001/health' },
    { name: 'documents', url: 'http://127.0.0.1:8002/health' },
    { name: 'api', url: 'http://127.0.0.1:4000/api/v1/health' },
    { name: 'web', url: `${WEB_URL}/login` },
  ],
};

const dataFile = (name) => `${DOCS_PATHS.data}/${name}`;

async function answers(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DATA_RULES.probeTimeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

async function requireServices() {
  const probes = await Promise.all(
    DATA_RULES.services.map(async (service) => ({ ...service, up: await answers(service.url) })),
  );
  const down = probes.filter(({ up }) => !up);
  if (down.length > 0) {
    const names = down.map(({ name, url }) => `${name} (${url})`).join(', ');
    throw new Error(`docs:data needs the running stack with demo data; no answer from ${names}`);
  }
}

function measureEval(kind, scratch) {
  const outFile = path.join(scratch, `ai-eval-${kind}.tsv`);
  run({
    command: 'pnpm',
    args: ['run', 'ai:eval', kind, outFile],
    cwd: inRepo('apps/api'),
    okCodes: [0, 1],
  });
  if (!existsSync(outFile)) {
    throw new Error(`ai:eval ${kind} wrote no report to ${outFile}`);
  }
  const problem = evalProblem(readFileSync(outFile, 'utf8'));
  if (problem !== null) {
    throw new Error(`The ${kind} eval is not written to ${DOCS_PATHS.data}: ${problem}`);
  }
  return { from: outFile, to: dataFile(`ai-eval-${kind}.tsv`) };
}

function writeEvals(scratch) {
  const reports = DATA_RULES.evalKinds.map((kind) => measureEval(kind, scratch));
  for (const { from, to } of reports) {
    copyFileSync(from, inRepo(to));
  }
  return reports.map(({ to }) => to);
}

function writeJson(relative, value) {
  writeFileSync(inRepo(relative), `${JSON.stringify(value, null, 2)}\n`);
  return relative;
}

function listE2e(scratch) {
  const reportFile = path.join(scratch, 'e2e-list.json');
  run({
    command: 'pnpm',
    args: ['exec', 'playwright', 'test', '--list', '--reporter=json'],
    cwd: inRepo('apps/web'),
    env: { PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile },
  });
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  return writeJson(dataFile('e2e.json'), { tests: e2eTests(report) });
}

function auditProd() {
  const report = run({ command: 'pnpm', args: ['audit', '--prod', '--json'], okCodes: [0, 1] });
  return writeJson(dataFile('audit.json'), { vulnerabilities: auditCounts(JSON.parse(report)) });
}

function takeScreenshots() {
  run({
    command: 'pnpm',
    args: ['exec', 'playwright', 'test', '-c', 'playwright.thesis.config.ts'],
    cwd: inRepo('apps/web'),
  });
}

function stamp(written, measuredAt) {
  const stampsPath = inRepo(DOCS_PATHS.stamps);
  const stamps = existsSync(stampsPath) ? JSON.parse(readFileSync(stampsPath, 'utf8')) : {};
  const fresh = Object.fromEntries(written.map((file) => [file, measuredAt]));
  writeJson(DOCS_PATHS.stamps, { ...stamps, ...fresh });
}

await requireServices();
const measuredAt = new Date().toISOString();
const scratch = mkdtempSync(path.join(os.tmpdir(), 'jobflow-docs-data-'));
mkdirSync(inRepo(DOCS_PATHS.data), { recursive: true });
const written = [
  ...writeEvals(scratch),
  writeJson(dataFile('coverage.json'), { packages: measureCoverage(scratch) }),
  listE2e(scratch),
  auditProd(),
];
takeScreenshots();
stamp(written, measuredAt);
