import { z } from 'zod';

export const errorResponseSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.int().min(400).max(599),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  requestId: z.string().min(1),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
