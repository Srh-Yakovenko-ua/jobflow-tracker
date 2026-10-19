import { describe, expect, it } from 'vitest';

import { OAUTH_PROVIDERS, oauthProviderSchema } from './oauth-providers.js';
import { THEMES, themeSchema } from './themes.js';

describe('themeSchema', () => {
  it('accepts every theme a user can pick in settings', () => {
    expect(THEMES.map((theme) => themeSchema.parse(theme))).toEqual(['light', 'dark', 'system']);
  });

  it('refuses a theme outside the list', () => {
    expect(themeSchema.safeParse('sepia').success).toBe(false);
  });
});

describe('oauthProviderSchema', () => {
  it('accepts the Google and GitHub sign-in providers', () => {
    expect(OAUTH_PROVIDERS.map((provider) => oauthProviderSchema.parse(provider))).toEqual([
      'google',
      'github',
    ]);
  });

  it('refuses a provider the API does not support', () => {
    expect(oauthProviderSchema.safeParse('facebook').success).toBe(false);
  });
});
