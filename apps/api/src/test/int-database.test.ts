import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const API_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const READ_INT_DATABASE_URL = `
const { default: config } = await import('./vitest.config.js');
const int = config.test.projects.find((project) => project.test.name === 'int');
process.stdout.write(int.test.env.DATABASE_URL);
`;

function intDatabaseUrl(databaseUrl?: string): string {
  const env = databaseUrl ? { DATABASE_URL: databaseUrl } : {};
  return execFileSync(process.execPath, ['--input-type=module', '-e', READ_INT_DATABASE_URL], {
    cwd: API_ROOT,
    env,
    encoding: 'utf8',
  });
}

describe('int project database', () => {
  it('defaults to the test database, never the shared dev one', () => {
    expect(new URL(intDatabaseUrl()).pathname).toBe('/jobflow_test');
  });

  it('keeps an exported DATABASE_URL', () => {
    const cardDatabase = 'postgresql://jobflow_app:jobflow_app@localhost:5432/jobflow_be_02';

    expect(intDatabaseUrl(cardDatabase)).toBe(cardDatabase);
  });
});
