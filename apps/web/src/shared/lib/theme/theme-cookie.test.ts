import { describe, expect, it } from 'vitest';

import { themeFromCookie } from './theme-cookie';

describe('themeFromCookie', () => {
  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    ['sepia', 'system'],
    [undefined, 'system'],
  ])('reads the cookie value %s as the %s theme', (value, theme) => {
    expect(themeFromCookie(value)).toBe(theme);
  });
});
