import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.email().max(254);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const authUserSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  displayName: z.string().nullable(),
  locale: z.string().min(1),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
