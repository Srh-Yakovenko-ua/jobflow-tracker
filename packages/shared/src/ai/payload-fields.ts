import type { AiKind } from './kinds.js';
import { matchInputSchema } from './match.js';
import { resumeParseInputSchema } from './resume-parse.js';
import { vacancyParseInputSchema } from './vacancy-parse.js';

export const AI_PAYLOAD_FIELDS = {
  vacancy_parse: vacancyParseInputSchema.keyof().options,
  resume_parse: resumeParseInputSchema.keyof().options,
  match: matchInputSchema.keyof().options,
} satisfies Record<AiKind, readonly string[]>;

export type AiPayloadField<Kind extends AiKind> = (typeof AI_PAYLOAD_FIELDS)[Kind][number];
