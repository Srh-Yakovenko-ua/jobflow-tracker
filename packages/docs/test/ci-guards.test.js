import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { DOCS_PATHS, inRepo } from '../src/paths.js';
import { run } from '../src/run.js';

const GUARDS = {
  preCommit: '.husky/pre-commit',
  zapRules: '.zap/rules.tsv',
  e2e: '.github/workflows/e2e.yml',
  secretLine: 'API_TOKEN=staged-value',
  colourAlways: {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'color.ui',
    GIT_CONFIG_VALUE_0: 'always',
  },
  csp: /CSP|Content Security Policy/,
  missingToken: '::error::login returned no accessToken',
};

const readRepo = (relative) => readFileSync(inRepo(relative), 'utf8');

function stagedDiffPipe() {
  const hookLine = readRepo(GUARDS.preCommit)
    .split('\n')
    .find((line) => line.startsWith('git diff'));
  assert.ok(hookLine !== undefined, 'the pre-commit hook has no git diff line');
  return hookLine.split(' | ').slice(0, 2).join(' | ');
}

function stagedLines(repo) {
  run({ command: 'git', args: ['init', '-q'], cwd: repo });
  writeFileSync(path.join(repo, 'leak.env'), `${GUARDS.secretLine}\n`);
  run({ command: 'git', args: ['add', 'leak.env'], cwd: repo });
  const piped = run({
    command: 'sh',
    args: ['-c', stagedDiffPipe()],
    cwd: repo,
    env: GUARDS.colourAlways,
    okCodes: [0, 1],
  });
  return piped.split('\n');
}

function tokenStep(body) {
  const line = readRepo(GUARDS.e2e)
    .split('\n')
    .find((text) => text.includes('token=$(curl'));
  assert.ok(line !== undefined, 'the fuzz step has no login token line');
  const script = line.trim().replace(/curl [^|]*\|/, `printf '%s' '${body}' |`);
  return spawnSync('bash', ['-eo', 'pipefail', '-c', script], { encoding: 'utf8' });
}

describe('CI and hook guards', () => {
  it('a staged secret reaches gitleaks with colour forced on', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'jobflow-ci-guards-'));
    try {
      assert.ok(stagedLines(repo).includes(`+${GUARDS.secretLine}`));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('a CSP alert is not hidden from the ZAP report', () => {
    const rules = readRepo(GUARDS.zapRules)
      .trim()
      .split('\n')
      .map((line) => line.split('\t'));
    const csp = rules.filter(([, , reason = '']) => GUARDS.csp.test(reason));

    assert.ok(
      csp.some(([id]) => id === '10055'),
      'rules.tsv has no row for 10055',
    );
    assert.deepEqual(
      csp.filter(([, action]) => action === 'IGNORE'),
      [],
    );
  });

  it('a login body without a token fails the fuzz step', () => {
    const missing = tokenStep('{}');
    const present = tokenStep('{"accessToken":"token"}');

    assert.notEqual(missing.status, 0);
    assert.ok(missing.stdout.includes(GUARDS.missingToken), missing.stdout);
    assert.equal(present.status, 0, present.stderr);
  });

  it('GlitchTip connects as its own role, not the superuser', () => {
    const [, environment = ''] = readRepo(DOCS_PATHS.compose).split('x-glitchtip-environment');
    const user = environment.match(/DATABASE_URL: postgres(?:ql)?:\/\/([^:@]+)/)?.[1];

    assert.equal(user, 'glitchtip');
  });
});
