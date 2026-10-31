import { z } from 'zod';

import { plainTextSchema } from '../schemas/text.js';
import { aiCallMetaSchema } from './call-meta.js';

export const AI_EMBED_LIMITS = { textMaxLength: 8000, maxTexts: 64 } as const;

export const AI_EMBED_INPUT_TYPES = ['query', 'passage'] as const;

export const aiEmbedRequestSchema = z.object({
  texts: z
    .array(plainTextSchema(AI_EMBED_LIMITS.textMaxLength))
    .min(1)
    .max(AI_EMBED_LIMITS.maxTexts),
  inputType: z.enum(AI_EMBED_INPUT_TYPES),
});

export const aiEmbeddingSchema = aiCallMetaSchema.extend({
  vectors: z.array(z.array(z.number())),
});

export type AiEmbedRequest = z.infer<typeof aiEmbedRequestSchema>;
export type AiEmbedding = z.infer<typeof aiEmbeddingSchema>;
