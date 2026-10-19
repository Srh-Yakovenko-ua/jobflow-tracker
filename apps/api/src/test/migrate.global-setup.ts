import { execFileSync } from 'node:child_process';

import type { TestProject } from 'vitest/node';

export default function migrateTestDatabase(project: TestProject): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: project.config.root,
    env: { ...process.env, ...project.config.env },
    stdio: 'pipe',
  });
}
