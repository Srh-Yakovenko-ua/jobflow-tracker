import { z } from 'zod';

const withoutNul = z.refine<string>((text) => !text.includes('\u0000'), {
  error: 'Text must not contain NUL characters',
});

export function plainTextSchema(maxLength: number) {
  return z.string().trim().min(1).max(maxLength).check(withoutNul);
}

export function rawTextSchema(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .regex(/\S/, { error: 'Text must not be blank' })
    .check(withoutNul);
}
