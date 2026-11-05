export const authKeys = {
  all: ['auth'] as const,
  oauthProviders: () => [...authKeys.all, 'oauth-providers'] as const,
};
