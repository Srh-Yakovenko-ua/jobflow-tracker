import { z } from 'zod';

import { userSettingsSchema } from './user-settings.js';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.email().max(254);
const newPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const givenPasswordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  displayName: z.string().trim().min(1).max(100).optional(),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: givenPasswordSchema,
});

export const changePasswordInputSchema = z.object({
  currentPassword: givenPasswordSchema,
  newPassword: newPasswordSchema,
});

export const authUserSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  displayName: z.string().nullable(),
  locale: z.string().min(1),
});

export const refreshTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const sessionTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: refreshTokenSchema.optional(),
});

export const authResponseSchema = sessionTokensSchema.extend({
  user: authUserSchema,
});

export const refreshTokenBodySchema = z
  .object({ refreshToken: refreshTokenSchema.optional() })
  .optional();

export const meResponseSchema = z.object({
  user: authUserSchema,
  settings: userSettingsSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type SessionTokens = z.infer<typeof sessionTokensSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
