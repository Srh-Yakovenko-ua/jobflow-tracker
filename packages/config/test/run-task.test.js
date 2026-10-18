import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { packagesWithScript } from '../bin/run-task.js';

const runTaskPath = path.join(import.meta.dirname, '..', 'bin', 'run-task.js');

function writeManifest(root, { dir, manifest }) {
  const packageDir = path.join(root, dir);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(manifest));
}

describe('run-task', () => {
  let tmpRoot;

  before(() => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'run-task-'));
    writeManifest(tmpRoot, {
      dir: 'packages/seeded',
      manifest: { name: '@fixture/seeded', scripts: { 'db:seed': 'node seed.js' } },
    });
    writeManifest(tmpRoot, {
      dir: 'apps/plain',
      manifest: { name: '@fixture/plain', scripts: { lint: 'eslint .' } },
    });
    mkdirSync(path.join(tmpRoot, 'services', 'uv-only'), { recursive: true });
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('finds the package that defines the script and skips the one that does not', () => {
    assert.deepEqual(packagesWithScript(tmpRoot, 'db:seed'), ['@fixture/seeded']);
  });

  it('prints which card brings a task that no package defines yet and exits 0', () => {
    const result = spawnSync(process.execPath, [runTaskPath, 'test:e2e', 'QA-01'], {
      cwd: tmpRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'pnpm test:e2e is not available yet: it arrives with QA-01.\n');
  });
});
