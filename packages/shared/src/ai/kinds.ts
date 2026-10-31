import { z } from 'zod';

export const AI_KINDS = ['vacancy_parse'] as const;

export const aiKindSchema = z.enum(AI_KINDS);

export type AiKind = z.infer<typeof aiKindSchema>;

export const AI_PROMPT_VERSIONS = { vacancy_parse: 'v1' } satisfies Record<AiKind, string>;
