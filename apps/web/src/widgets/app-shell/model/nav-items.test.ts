import { describe, expect, it } from 'vitest';

import { FEATURE_FLAGS } from '@/shared/config';
import { EVERY_FLAG_ON } from '@/test/feature-flags';

import { activeHrefOf, NAV_ITEMS, visibleNavItems } from './nav-items';

describe('visibleNavItems', () => {
  it('shows the board and settings while no other page has shipped', () => {
    expect(visibleNavItems(FEATURE_FLAGS).map((item) => item.id)).toEqual(['board', 'settings']);
  });

  it('shows all six pages in order once every flag is on', () => {
    expect(visibleNavItems(EVERY_FLAG_ON).map((item) => item.id)).toEqual([
      'board',
      'analytics',
      'calendar',
      'resumes',
      'reminders',
      'settings',
    ]);
  });
});

describe('activeHrefOf', () => {
  it.each([
    ['/board', '/board'],
    ['/board/archive', '/board'],
    ['/settings', '/settings'],
    ['/boardroom', undefined],
    ['/applications/1', undefined],
  ])('marks %s as %s', (pathname, active) => {
    expect(activeHrefOf(pathname, NAV_ITEMS)).toBe(active);
  });
});
