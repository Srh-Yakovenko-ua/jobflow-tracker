import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { ESLint } from 'eslint';

import { api, base, web } from '../eslint.js';

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

const SHAPE_RULE_IDS = new Set([
  '@typescript-eslint/max-params',
  'max-params',
  'max-lines-per-function',
  'max-lines',
  'max-depth',
  'complexity',
  'max-nested-callbacks',
  'no-restricted-syntax',
]);

function shapeMessagesOf(messages) {
  return messages.filter((message) => SHAPE_RULE_IDS.has(message.ruleId));
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

describe('shape rules', () => {
  let messagesByFile;

  before(async () => {
    messagesByFile = await lintFixture(base, 'shape');
  });

  function shapeRuleIds(file) {
    return ruleIdsOf(shapeMessagesOf(messagesByFile[file]));
  }

  it('refuses three positional parameters and accepts one options object', () => {
    assert.deepEqual(shapeRuleIds('params-three.ts'), ['@typescript-eslint/max-params']);
    assert.deepEqual(shapeRuleIds('params-options.ts'), []);
  });

  it('refuses a typed, a union and a defaulted boolean positional parameter', () => {
    const messages = shapeMessagesOf(messagesByFile['boolean-param.ts']);

    assert.deepEqual(
      messages.map((message) => [message.ruleId, message.line, message.message]),
      [1, 5, 9].map((line) => [
        'no-restricted-syntax',
        line,
        'Boolean positional parameter: use a named field in an options object',
      ]),
    );
  });

  it('accepts a boolean as a named field of an options object', () => {
    assert.deepEqual(shapeRuleIds('boolean-option.ts'), []);
  });

  it('refuses a function over 40 lines in a .ts file', () => {
    assert.deepEqual(shapeRuleIds('long-function.ts'), ['max-lines-per-function']);
  });

  it('allows 80 lines per function in a .tsx file and refuses more', () => {
    const messages = shapeMessagesOf(messagesByFile['long-component.tsx']);

    assert.deepEqual(
      messages.map((message) => [message.ruleId, message.line]),
      [['max-lines-per-function', 63]],
    );
  });

  it('refuses a file over 200 lines', () => {
    assert.deepEqual(shapeRuleIds('long-file.ts'), ['max-lines']);
  });

  it('refuses nesting deeper than three blocks', () => {
    assert.deepEqual(shapeRuleIds('deep-nesting.ts'), ['max-depth']);
  });

  it('refuses a complexity over 10', () => {
    assert.deepEqual(shapeRuleIds('complex.ts'), ['complexity']);
  });

  it('refuses callbacks nested deeper than three', () => {
    assert.deepEqual(shapeRuleIds('nested-callbacks.ts'), ['max-nested-callbacks']);
  });

  it('lifts the length limits in a test file and keeps the nesting limit', () => {
    assert.deepEqual(shapeRuleIds('long.test.ts'), ['max-depth']);
  });

  it('exempts a Nest constructor and still refuses a three-parameter method', () => {
    const messages = shapeMessagesOf(messagesByFile['notes.service.ts']);

    assert.deepEqual(
      messages.map((message) => [message.ruleId, message.line, message.message]),
      [
        [
          'no-restricted-syntax',
          12,
          'More than two positional parameters: pass one options object',
        ],
      ],
    );
  });

  it('exempts a controller handler whose parameters are decorated', () => {
    assert.deepEqual(shapeRuleIds('notes.controller.ts'), []);
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
