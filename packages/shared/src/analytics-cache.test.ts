import { describe, expect, it } from 'vitest';

import { ANALYTICS_CACHE, analyticsVersionKey } from './analytics-cache.js';

const USER_ID = '0b9c7a4e-1f2d-4c3b-9a8e-5d6f7a8b9c0d';

describe('analyticsVersionKey', () => {
  it('fills the user id into the per-user version key', () => {
    expect(analyticsVersionKey(USER_ID)).toBe(
      'analytics:0b9c7a4e-1f2d-4c3b-9a8e-5d6f7a8b9c0d:version',
    );
  });

  it('gives two users two version keys', () => {
    expect(analyticsVersionKey('user-a')).not.toBe(analyticsVersionKey('user-b'));
  });
});

describe('ANALYTICS_CACHE', () => {
  it('keeps entries for one hour as a safety net', () => {
    expect(ANALYTICS_CACHE.ttlSeconds).toBe(3600);
  });

  it('puts the user and the version in front of the metric and params hash', () => {
    expect(ANALYTICS_CACHE.entryKey).toBe('analytics:{userId}:v{version}:{metric}:{paramsHash}');
  });
});
