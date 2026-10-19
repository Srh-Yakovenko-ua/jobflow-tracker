import { readFileSync } from 'node:fs';
import { parseEnv as parseDotenv } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadEnv, parseEnv, validateEnv } from './env.js';

const exampleEnv = parseDotenv(
  readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8'),
);

class ExitCalled extends Error {
  constructor(readonly code: string | number | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

function captureBootFailure(source: NodeJS.ProcessEnv) {
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitCalled(code);
  });
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  expect(() => loadEnv(source)).toThrow(ExitCalled);
  return { exit, written: stderr.mock.calls.map(([chunk]) => String(chunk)).join('') };
}

function failedPaths(source: NodeJS.ProcessEnv) {
  const result = parseEnv(source);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadEnv', () => {
  it('accepts .env.example with empty optional keys', () => {
    const env = loadEnv(exampleEnv);

    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.AI_DAILY_LIMIT).toBe(50);
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('exits with code 1 and names DATABASE_URL when it is missing', () => {
    const withoutDatabase = Object.fromEntries(
      Object.entries(exampleEnv).filter(([key]) => key !== 'DATABASE_URL'),
    );

    const { exit, written } = captureBootFailure(withoutDatabase);

    expect(exit).toHaveBeenCalledWith(1);
    expect(written).toContain('Invalid environment');
    expect(written).toContain('DATABASE_URL');
  });

  it('keeps secret values out of the error output', () => {
    const { written } = captureBootFailure({
      ...exampleEnv,
      DATABASE_URL: 'mysql://user:hunter2@localhost/jobflow',
    });

    expect(written).toContain('DATABASE_URL');
    expect(written).not.toContain('hunter2');
  });
});

describe('validateEnv', () => {
  it('throws an error naming DATABASE_URL without its secret value', () => {
    const source = { ...exampleEnv, DATABASE_URL: 'mysql://user:hunter2@localhost/jobflow' };

    expect(() => validateEnv(source)).toThrow(/Invalid environment[\s\S]*DATABASE_URL/);
    expect(() => validateEnv(source)).not.toThrow(/hunter2/);
  });

  it('defaults PORT to 4000 when it is empty', () => {
    expect(validateEnv({ ...exampleEnv, PORT: '' }).PORT).toBe(4000);
  });

  it('defaults AI_SERVICE_URL to http://localhost:8001 when it is empty', () => {
    expect(validateEnv({ ...exampleEnv, AI_SERVICE_URL: '' }).AI_SERVICE_URL).toBe(
      'http://localhost:8001',
    );
  });

  it('reads PORT as a number', () => {
    expect(validateEnv({ ...exampleEnv, PORT: '4100' }).PORT).toBe(4100);
  });

  it('refuses a PORT outside 1 to 65535', () => {
    expect(() => validateEnv({ ...exampleEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('defaults NODE_ENV to development when it is empty', () => {
    expect(validateEnv({ ...exampleEnv, NODE_ENV: '' }).NODE_ENV).toBe('development');
  });

  it('defaults HOST to 127.0.0.1 when it is empty', () => {
    expect(validateEnv({ ...exampleEnv, HOST: '' }).HOST).toBe('127.0.0.1');
  });

  it('reads HOST 0.0.0.0 for the container', () => {
    expect(validateEnv({ ...exampleEnv, HOST: '0.0.0.0' }).HOST).toBe('0.0.0.0');
  });

  it('reads NODE_ENV production', () => {
    expect(validateEnv({ ...exampleEnv, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });
});

describe('parseEnv', () => {
  it('refuses a NODE_ENV other than development, test or production', () => {
    expect(failedPaths({ ...exampleEnv, NODE_ENV: 'staging' })).toEqual(['NODE_ENV']);
  });

  it('refuses a HOST that is not an IP address', () => {
    expect(failedPaths({ ...exampleEnv, HOST: 'example.com' })).toEqual(['HOST']);
  });

  it('treats an empty DATABASE_URL as missing', () => {
    expect(failedPaths({ ...exampleEnv, DATABASE_URL: '' })).toEqual(['DATABASE_URL']);
  });

  it('refuses a REDIS_URL with a scheme other than redis or rediss', () => {
    expect(failedPaths({ ...exampleEnv, REDIS_URL: 'http://localhost:6379' })).toEqual([
      'REDIS_URL',
    ]);
  });
});
