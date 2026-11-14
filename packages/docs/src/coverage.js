import { readFileSync } from 'node:fs';
import path from 'node:path';

import { inRepo } from './paths.js';
import { run } from './run.js';
import { pytestRow, vitestRow } from './snapshots.js';

const VITEST_PACKAGES = [
  { name: '@jobflow/api', dir: 'apps/api', args: ['--project', 'unit'] },
  { name: '@jobflow/web', dir: 'apps/web', args: [] },
  { name: '@jobflow/shared', dir: 'packages/shared', args: [] },
  { name: '@jobflow/bookmarklet', dir: 'bookmarklet', args: [] },
];

const PYTEST_PACKAGES = [
  { name: '@jobflow/analytics', dir: 'services/analytics' },
  { name: '@jobflow/ai', dir: 'services/ai' },
  { name: '@jobflow/documents', dir: 'services/documents' },
];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function vitestCoverage({ name, dir, args }, scratch) {
  const resultsFile = path.join(scratch, `${path.basename(dir)}-vitest.json`);
  run({
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      '--coverage',
      ...args,
      '--reporter=json',
      `--outputFile=${resultsFile}`,
    ],
    cwd: inRepo(dir),
  });
  return vitestRow({
    name,
    results: readJson(resultsFile),
    summary: readJson(inRepo(`${dir}/coverage/coverage-summary.json`)),
  });
}

function pytestCoverage({ name, dir }, scratch) {
  const coverageFile = path.join(scratch, `${path.basename(dir)}-coverage.json`);
  const junitFile = path.join(scratch, `${path.basename(dir)}-junit.xml`);
  run({
    command: 'uv',
    args: [
      'run',
      'pytest',
      '-q',
      '--cov=app',
      `--cov-report=json:${coverageFile}`,
      `--junitxml=${junitFile}`,
    ],
    cwd: inRepo(dir),
  });
  return pytestRow({
    name,
    junit: readFileSync(junitFile, 'utf8'),
    coverage: readJson(coverageFile),
  });
}

export function measureCoverage(scratch) {
  return [
    ...VITEST_PACKAGES.map((target) => vitestCoverage(target, scratch)),
    ...PYTEST_PACKAGES.map((target) => pytestCoverage(target, scratch)),
  ];
}
