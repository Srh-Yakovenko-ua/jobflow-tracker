import { z } from 'zod';

import { aiCallMetaSchema } from './call-meta.js';
import type { AiKind } from './kinds.js';
import { vacancyParseInputSchema, vacancyParseOutputSchema } from './vacancy-parse.js';

export const aiCompleteOptionsSchema = z.object({
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.int().min(1).max(4096).optional(),
});

export const AI_KIND_SCHEMAS = {
  vacancy_parse: { input: vacancyParseInputSchema, output: vacancyParseOutputSchema },
} satisfies Record<AiKind, { input: z.ZodType; output: z.ZodType }>;

const completionMetaSchema = aiCallMetaSchema.extend({
  promptVersion: z.string().min(1),
  tokensOut: z.int().nonnegative(),
});

export const aiCompleteRequestSchemas = {
  vacancy_parse: aiCompleteOptionsSchema.extend({ input: AI_KIND_SCHEMAS.vacancy_parse.input }),
} satisfies Record<AiKind, z.ZodType>;

export const aiCompletionSchemas = {
  vacancy_parse: completionMetaSchema.extend({ output: AI_KIND_SCHEMAS.vacancy_parse.output }),
} satisfies Record<AiKind, z.ZodType>;

type KindSchemas = typeof AI_KIND_SCHEMAS;

export type AiKindInput<Kind extends AiKind> = z.infer<KindSchemas[Kind]['input']>;
export type AiKindOutput<Kind extends AiKind> = z.infer<KindSchemas[Kind]['output']>;
export type AiCompleteOptions = z.infer<typeof aiCompleteOptionsSchema>;
export type AiCompleteRequest<Kind extends AiKind> = z.infer<
  (typeof aiCompleteRequestSchemas)[Kind]
>;
export type AiCompletion<Kind extends AiKind> = z.infer<(typeof aiCompletionSchemas)[Kind]>;
