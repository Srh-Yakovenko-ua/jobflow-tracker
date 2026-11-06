import { z } from 'zod';

const webUrlSchema = z.url({ protocol: /^https?$/ });

export function webUrlOf(value: string | null): string | null {
  return value !== null && webUrlSchema.safeParse(value).success ? value : null;
}
