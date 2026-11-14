import { spawnSync } from 'node:child_process';

import { REPO_ROOT } from './paths.js';

export function run({ command, args = [], cwd = REPO_ROOT, env = {}, okCodes = [0] }) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined || !okCodes.includes(result.status ?? -1)) {
    const cause = result.error?.message ?? `exit code ${String(result.status)}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${cause}`);
  }
  return result.stdout;
}
