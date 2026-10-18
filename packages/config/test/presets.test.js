import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { ESLint } from 'eslint';

import { api, web } from '../eslint.js';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');
const tsgoPath = path.join(import.meta.dirname, '..', 'bin', 'tsgo.js');

async function lintFixture(preset, fixtureName) {
  const cwd = path.join(fixturesDir, fixtureName);
  const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: preset(cwd) });
  const results = await eslint.lintFiles(['src']);
  return Object.fromEntries(
    results.map((result) => [
      path.relative(path.join(cwd, 'src'), result.filePath),
      result.messages,
    ]),
  );
}

function ruleIdsOf(messages) {
  return messages.map((message) => message.ruleId);
}

function runTsgo(args) {
  return spawnSync(process.execPath, [tsgoPath, ...args], { encoding: 'utf8' });
}

describe('api preset', () => {
  let messagesByFile;

  before(async () => {
    messagesByFile = await lintFixture(api, 'api');
  });

  it('refuses an import of another module internals', () => {
    assert.deepEqual(ruleIdsOf(messagesByFile['modules/applications/applications.service.ts']), [
      'boundaries/dependencies',
    ]);
  });

  it('refuses an import of module internals from outside every module', () => {
    assert.deepEqual(ruleIdsOf(messagesByFile['app.ts']), ['boundaries/dependencies']);
  });

  it('allows an import of another module through its index', () => {
    assert.deepEqual(messagesByFile['modules/notes/notes.service.ts'], []);
  });

  it('allows imports inside the same module', () => {
    assert.deepEqual(messagesByFile['modules/auth/index.ts'], []);
  });
});

describe('web preset', () => {
  let messages;

  before(async () => {
    messages = (await lintFixture(web, 'web'))['stage-counter.tsx'];
  });

  it('parses a component without a fatal error', () => {
    assert.deepEqual(
      messages.filter((message) => message.fatal),
      [],
    );
  });

  it('reports a hook called inside a condition once, through react-hooks', () => {
    assert.deepEqual(
      ruleIdsOf(messages).filter((ruleId) => ruleId.endsWith('rules-of-hooks')),
      ['react-hooks/rules-of-hooks'],
    );
  });

  it('runs the React and Next rules on a component', () => {
    const ruleIds = ruleIdsOf(messages);

    assert.ok(ruleIds.includes('@eslint-react/no-unnecessary-use-prefix'));
    assert.ok(ruleIds.includes('@next/next/no-img-element'));
  });
});

describe('tsgo', () => {
  it('runs the TypeScript 7 checker', () => {
    const run = runTsgo(['--version']);

    assert.equal(run.status, 0);
    assert.match(run.stdout, /^Version 7\./);
  });

  it('reports an unchecked indexed read under the strict base', () => {
    const run = runTsgo(['-p', path.join(fixturesDir, 'strict'), '--noEmit']);

    assert.notEqual(run.status, 0);
    assert.match(
      run.stdout,
      /error TS2322: Type 'string \| undefined' is not assignable to type 'string'/,
    );
  });

  it('accepts a module tree that follows the strict base', () => {
    const run = runTsgo(['-p', path.join(fixturesDir, 'api'), '--noEmit']);

    assert.equal(run.stdout, '');
    assert.equal(run.status, 0);
  });
});
