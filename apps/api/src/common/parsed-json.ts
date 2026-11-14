import type { z } from 'zod';

export function parsedJson<Output>(schema: z.ZodType<Output>, text: string): Output | undefined {
  try {
    return schema.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
}
