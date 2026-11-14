import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from './content-security-policy';

const ORIGINS = [
  'http://localhost:4000',
  'http://localhost:8000/',
  'http://localhost:9000/resumes',
];

function scriptSources(policy: string): string | undefined {
  return policy.split('; ').find((directive) => directive.startsWith('script-src '));
}

describe('buildContentSecurityPolicy', () => {
  it('allows scripts only by nonce and lists the API, analytics and files origins in production', () => {
    expect(buildContentSecurityPolicy({ nonce: 'bm9uY2U=', dev: false, origins: ORIGINS })).toBe(
      "default-src 'self'; script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' http://localhost:4000 http://localhost:8000 http://localhost:9000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
  });

  it('adds only unsafe-eval to the scripts in development', () => {
    const production = buildContentSecurityPolicy({ nonce: 'n', dev: false, origins: ORIGINS });
    const development = buildContentSecurityPolicy({ nonce: 'n', dev: true, origins: ORIGINS });

    expect(development).toBe(
      production.replace("'strict-dynamic';", "'strict-dynamic' 'unsafe-eval';"),
    );
  });

  it.each([false, true])('never allows inline scripts when dev is %s', (dev) => {
    expect(
      scriptSources(buildContentSecurityPolicy({ nonce: 'n', dev, origins: ORIGINS })),
    ).not.toContain("'unsafe-inline'");
  });
});
