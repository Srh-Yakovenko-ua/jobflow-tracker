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
});
