#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIRS = ['apps', 'packages', 'services'];

function manifestsIn(root, dir) {
  const parent = path.join(root, dir);
  if (!existsSync(parent)) {
    return [];
  }
  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name, 'package.json'))
    .filter((manifestPath) => existsSync(manifestPath))
    .map((manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf8')));
}

export function packagesWithScript(root, task) {
  return WORKSPACE_DIRS.flatMap((dir) => manifestsIn(root, dir))
    .filter((manifest) => manifest.scripts?.[task] !== undefined)
    .map((manifest) => manifest.name);
}

function main() {
  const [task, card, ...turboArgs] = process.argv.slice(2);

  if (packagesWithScript(process.cwd(), task).length === 0) {
    process.stdout.write(`pnpm ${task} is not available yet: it arrives with ${card}.\n`);
    process.exit(0);
  }

  const result = spawnSync('turbo', ['run', task, ...turboArgs], { stdio: 'inherit' });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (import.meta.main) {
  main();
}
