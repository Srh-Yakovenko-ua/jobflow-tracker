import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from './proxy';

type ProxyCase = { name: string; path: string; signedIn: boolean; location: string | null };

const ORIGIN = 'http://localhost:3000';

function requestTo({ path, signedIn }: Pick<ProxyCase, 'path' | 'signedIn'>): NextRequest {
  const request = new NextRequest(`${ORIGIN}${path}`);
  if (signedIn) {
    request.cookies.set('jobflow_session', '1');
  }
  return request;
}

const CASES: ProxyCase[] = [
  {
    name: 'sends a signed-out card link to login with the card in next',
    path: '/applications/123?tab=notes',
    signedIn: false,
    location: `${ORIGIN}/login?next=%2Fapplications%2F123%3Ftab%3Dnotes`,
  },
  {
    name: 'sends a signed-out bookmarklet fallback with a long Cyrillic text to login with the link kept and the text dropped',
    path: `/add?url=https%3A%2F%2Fjobs.test%2F1&text=${'%D0%B0'.repeat(2_139)}`,
    signedIn: false,
    location: `${ORIGIN}/login?next=%2Fadd%3Furl%3Dhttps%253A%252F%252Fjobs.test%252F1`,
  },
  { name: 'lets a signed-in board through', path: '/board', signedIn: true, location: null },
  {
    name: 'sends a signed-in login back to the requested card',
    path: '/login?next=%2Fapplications%2F123',
    signedIn: true,
    location: `${ORIGIN}/applications/123`,
  },
  {
    name: 'sends a signed-in login with another origin in next to the board',
    path: '/login?next=https%3A%2F%2Fevil.test',
    signedIn: true,
    location: `${ORIGIN}/board`,
  },
  {
    name: 'sends a signed-in login with a dot-segment host in next to the board',
    path: '/login?next=%2F..%2F%2Fevil.test',
    signedIn: true,
    location: `${ORIGIN}/board`,
  },
  {
    name: 'sends a signed-in register to the board',
    path: '/register',
    signedIn: true,
    location: `${ORIGIN}/board`,
  },
  { name: 'lets a signed-out login through', path: '/login', signedIn: false, location: null },
];

describe('proxy', () => {
  it.each(CASES)('$name', ({ path, signedIn, location }) => {
    const response = proxy(requestTo({ path, signedIn }));

    expect({ status: response.status, location: response.headers.get('location') }).toEqual({
      status: location === null ? 200 : 307,
      location,
    });
  });

  it('answers a signed-in board with a script nonce that matches the policy forwarded to Next', () => {
    const response = proxy(requestTo({ path: '/board', signedIn: true }));
    const policy = response.headers.get('content-security-policy') ?? '';

    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{20,}' 'strict-dynamic'/);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
  });

  it('gives each request its own nonce', () => {
    const [first, second] = [1, 2].map(() =>
      proxy(requestTo({ path: '/board', signedIn: true })).headers.get('content-security-policy'),
    );

    expect(first).toContain("'nonce-");
    expect(first).not.toBe(second);
  });

  it.each(['/design-system', '/dev/ui'])('lets a signed-out %s through with the policy', (path) => {
    const response = proxy(requestTo({ path, signedIn: false }));

    expect({
      status: response.status,
      frameAncestors: response.headers
        .get('content-security-policy')
        ?.includes("frame-ancestors 'none'"),
    }).toEqual({ status: 200, frameAncestors: true });
  });
});
