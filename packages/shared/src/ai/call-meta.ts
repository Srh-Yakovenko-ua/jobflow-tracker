import { z } from 'zod';

export const aiCallMetaSchema = z.object({
  model: z.string().min(1),
  tokensIn: z.int().nonnegative(),
  latencyMs: z.int().nonnegative(),
});
