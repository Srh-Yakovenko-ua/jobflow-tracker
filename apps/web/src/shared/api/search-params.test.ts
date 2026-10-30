import { describe, expect, it } from 'vitest';

import { withSearchParams } from './search-params';

describe('withSearchParams', () => {
  it('joins a list with commas and writes booleans as words', () => {
    expect(
      withSearchParams('/applications/board', { silence: ['warn', 'silent'], hasScore: false }),
    ).toBe('/applications/board?silence=warn%2Csilent&hasScore=false');
  });

  it('skips the keys left undefined and encodes the search text', () => {
    expect(withSearchParams('/applications', { q: 'R&D Київ', cursor: undefined, limit: 8 })).toBe(
      '/applications?q=R%26D+%D0%9A%D0%B8%D1%97%D0%B2&limit=8',
    );
  });

  it('leaves the path bare when no key has a value', () => {
    expect(withSearchParams('/applications/board', { expand: undefined })).toBe(
      '/applications/board',
    );
  });
});
