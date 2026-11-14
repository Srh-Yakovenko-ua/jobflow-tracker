import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { manifestProblems } from '../src/manifest.js';
import { REPO_ROOT } from '../src/paths.js';

const FIGURES = [
  {
    id: 'deployment',
    type: 'diagram',
    caption: 'Розгортання в Docker Compose',
    source: 'docs/diagrams/deployment.mmd',
  },
  {
    id: 'board-light',
    type: 'screenshot',
    caption: 'Дошка, світла тема',
    source: 'docs/screenshots/board-light.png',
  },
];

const BASE_FILES = {
  'docs/thesis/figures.json': JSON.stringify({ figures: FIGURES }),
  'docs/diagrams/deployment.mmd':
    'flowchart LR\n  postgres --> minio-init\n  minio-init --> minio\n',
  'docs/screenshots/board-light.png': 'png',
  'infra/docker/compose.yml':
    'name: demo\n\nservices:\n  postgres:\n    image: postgres\n  minio:\n    image: minio\n  minio-init:\n    image: mc\n\nvolumes:\n  pgdata:\n',
  'docs/thesis/methods.md':
    'Таблиці будує `packages/docs/src/tables.js` командою `pnpm docs:build`.\n',
  'packages/docs/src/tables.js': '',
};

const roots = [];

function repoWith(overrides) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jobflow-docs-'));
  roots.push(root);
  for (const [relative, text] of Object.entries({ ...BASE_FILES, ...overrides })) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), text);
  }
  return root;
}

const withFigures = (figures) => ({ 'docs/thesis/figures.json': JSON.stringify({ figures }) });

describe('figure manifest', () => {
  after(() => {
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts a manifest where every figure has a Ukrainian caption and a real source', () => {
    assert.deepEqual(manifestProblems(repoWith({})), []);
  });

  it('refuses an empty caption and a missing source', () => {
    const [deployment, board] = FIGURES;
    const problems = manifestProblems(
      repoWith(
        withFigures([
          { ...deployment, caption: '' },
          { ...board, source: 'docs/gone.png' },
        ]),
      ),
    );

    assert.deepEqual(problems, [
      'docs/thesis/figures.json deployment: caption is empty or not Ukrainian',
      'docs/thesis/figures.json board-light: source docs/gone.png does not exist',
      'docs/screenshots/board-light.png is not listed in docs/thesis/figures.json',
    ]);
  });

  it('refuses a diagram or a screenshot that the manifest does not list', () => {
    const problems = manifestProblems(
      repoWith({
        'docs/diagrams/c4-context.mmd': 'C4Context\n',
        'docs/screenshots/board-dark.png': 'png',
      }),
    );

    assert.deepEqual(problems, [
      'docs/diagrams/c4-context.mmd is not listed in docs/thesis/figures.json',
      'docs/screenshots/board-dark.png is not listed in docs/thesis/figures.json',
    ]);
  });

  it('refuses a compose service the deployment view leaves out', () => {
    const problems = manifestProblems(
      repoWith({ 'docs/diagrams/deployment.mmd': 'flowchart LR\n  postgres --> minio-init\n' }),
    );

    assert.deepEqual(problems, [
      'compose service minio is missing from docs/diagrams/deployment.mmd',
    ]);
  });

  it('refuses a repo path named in a thesis chapter that does not exist', () => {
    const problems = manifestProblems(
      repoWith({ 'docs/thesis/methods.md': 'Див. `services/analytics/app/metrics/gone.py:12`.\n' }),
    );

    assert.deepEqual(problems, [
      'docs/thesis/methods.md names services/analytics/app/metrics/gone.py, which does not exist',
    ]);
  });

  it('finds no problem in the repository manifest', () => {
    assert.deepEqual(manifestProblems(REPO_ROOT), []);
  });
});
