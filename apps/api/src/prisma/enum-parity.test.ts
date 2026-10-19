import { OAUTH_PROVIDERS, THEMES } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { OAuthProvider, Theme } from '../generated/prisma/enums.js';

describe('Prisma enums', () => {
  it.each([
    { name: 'Theme', generated: Theme, shared: THEMES },
    { name: 'OAuthProvider', generated: OAuthProvider, shared: OAUTH_PROVIDERS },
  ])('keeps $name equal to the list in @jobflow/shared', ({ generated, shared }) => {
    expect(new Set(Object.values(generated))).toEqual(new Set(shared));
  });
});
