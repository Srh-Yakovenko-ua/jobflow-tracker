import { describe, expect, it } from 'vitest';

import { FEATURE_FLAGS, type FeatureFlags } from '@/shared/config';

import { activeHrefOf, NAV_ITEMS, visibleNavItems } from './nav-items';

const EVERY_FLAG_ON: FeatureFlags = {
  analytics: true,
  calendar: true,
  resumes: true,
  reminders: true,
  settings: true,
  addApplication: true,
};

describe('visibleNavItems', () => {
  it('shows only the board while no other page has shipped', () => {
    expect(visibleNavItems(FEATURE_FLAGS).map((item) => item.id)).toEqual(['board']);
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
