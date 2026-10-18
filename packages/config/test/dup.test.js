import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const repoRoot = path.join(import.meta.dirname, '..', '..', '..');
const jscpdBin = path.join(
  path.dirname(createRequire(import.meta.url).resolve('jscpd/package.json')),
  'run-jscpd.js',
);

const sharedBlock = `
  const total = items.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const discount = total > 1000 ? total * 0.1 : total > 500 ? total * 0.05 : 0;
  const taxed = (total - discount) * (1 + rate);
  const rounded = Math.round(taxed * 100) / 100;
  return { total, discount, taxed, rounded, label: \`\${String(rounded)} UAH\` };
`;

function writeTree(dir, files) {
  mkdirSync(dir);
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

function runJscpd(dir) {
  return spawnSync(
    process.execPath,
    [jscpdBin, '--config', path.join(repoRoot, '.jscpd.json'), dir],
    { encoding: 'utf8' },
  );
}

describe('pnpm dup', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'jobflow-dup-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails on a block of five lines copied into a second file', () => {
    const dir = writeTree(path.join(tmpDir, 'copied'), {
      'invoice.ts': `export function invoice(items, rate) {${sharedBlock}}\n`,
      'receipt.ts': `export function receipt(items, rate) {${sharedBlock}}\n`,
    });

    assert.equal(runJscpd(dir).status, 1);
  });

  it('passes a tree with no shared block', () => {
    const dir = writeTree(path.join(tmpDir, 'unique'), {
      'invoice.ts': `export function invoice(items, rate) {${sharedBlock}}\n`,
      'greeting.ts': 'export function greeting(name) {\n  return `Hello, ${name}`;\n}\n',
    });

    assert.equal(runJscpd(dir).status, 0);
  });
});
