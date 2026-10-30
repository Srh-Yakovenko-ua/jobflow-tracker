import { type AuthResponse, authResponseSchema, type LoginInput } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

import type { AuthModeSpec } from '../model/auth-modes';

export type AuthenticateRequest = { path: AuthModeSpec['path']; credentials: LoginInput };

export function authenticate({ path, credentials }: AuthenticateRequest): Promise<AuthResponse> {
  return apiClient.request({ path, method: 'POST', body: credentials, schema: authResponseSchema });
}
