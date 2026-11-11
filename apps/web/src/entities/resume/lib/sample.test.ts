import { describe, expect, it } from 'vitest';

import { missingForPercent } from './sample';

describe('missingForPercent', () => {
  it.each([
    { applicationsCount: 0, missing: 5 },
    { applicationsCount: 2, missing: 3 },
    { applicationsCount: 4, missing: 1 },
    { applicationsCount: 5, missing: 0 },
    { applicationsCount: 27, missing: 0 },
  ])(
    'a version with $applicationsCount applications needs $missing more before it gets a percent',
    ({ applicationsCount, missing }) => {
      expect(missingForPercent(applicationsCount)).toBe(missing);
    },
  );
});
