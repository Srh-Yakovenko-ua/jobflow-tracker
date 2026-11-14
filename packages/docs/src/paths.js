import path from 'node:path';

export const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');

export const DOCS_PATHS = {
  manifest: 'docs/thesis/figures.json',
  build: 'docs/thesis/build',
  data: 'docs/thesis/data',
  diagrams: 'docs/diagrams',
  screenshots: 'docs/screenshots',
  thesis: 'docs/thesis',
  compose: 'infra/docker/compose.yml',
  deployment: 'docs/diagrams/deployment.mmd',
  stamps: 'docs/thesis/data/snapshots.json',
};

export const inRepo = (relative) => path.join(REPO_ROOT, relative);
