import { z } from 'zod';

export const TOKEN_SCOPES = ['user', 'analytics:read', 'capture', 'ai:invoke'] as const;

export const tokenScopeSchema = z.enum(TOKEN_SCOPES);

export type TokenScope = z.infer<typeof tokenScopeSchema>;

export const USER_TOKEN_SCOPES: readonly TokenScope[] = ['user', 'analytics:read'];
