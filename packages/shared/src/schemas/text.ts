import { z } from 'zod';

export function plainTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((text) => !text.includes('\u0000'), { error: 'Text must not contain NUL characters' });
}
