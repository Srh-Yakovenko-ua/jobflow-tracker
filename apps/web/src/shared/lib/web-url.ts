import { z } from 'zod';

const webUrlSchema = z.url({ protocol: /^https?$/ });

export const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function webUrlOf(value: string | null): string | null {
  return value !== null && webUrlSchema.safeParse(value).success ? value : null;
}
