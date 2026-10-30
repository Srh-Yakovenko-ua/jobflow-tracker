import { describe, expect, it } from 'vitest';

import { loginHref, safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it.each([
    ['/applications/123', '/applications/123'],
    ['/applications/123?tab=notes#history', '/applications/123?tab=notes#history'],
    ['/analytics?range=90d', '/analytics?range=90d'],
  ])('keeps the same-origin path %s', (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it.each([
    ['another origin', 'https://evil.test/board'],
    ['a protocol-relative URL', '//evil.test/board'],
    ['a backslash host', '/\\evil.test/board'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a tab inside the slashes', '/\t/evil.test'],
    ['a newline inside the slashes', '/\n/evil.test'],
    ['a leading space before the slashes', ' //evil.test'],
    ['a parent segment before the slashes', '/..//evil.test/board'],
    ['a dot segment before the slashes', '/.//evil.test'],
    ['an encoded parent segment before the slashes', '/%2e%2e//evil.test'],
    ['an encoded dot segment before the slashes', '/%2e//evil.test'],
    ['a folder and a parent segment before the slashes', '/a/..//evil.test'],
    ['a dot segment before a backslash host', '/./\\evil.test'],
    ['the login page', '/login?next=%2Fboard'],
    ['the register page', '/register'],
    ['a repeated param', ['/applications/123', '/board']],
    ['a missing param', undefined],
  ])('sends %s to the board', (_name, value) => {
    expect(safeReturnTo(value)).toBe('/board');
  });
});

describe('loginHref', () => {
  it('carries the requested path and its query in next', () => {
    expect(loginHref('/applications/123?tab=notes')).toBe(
      '/login?next=%2Fapplications%2F123%3Ftab%3Dnotes',
    );
  });
});
