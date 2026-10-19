import { z } from 'zod';

export const OAUTH_PROVIDERS = ['google', 'github'] as const;

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
