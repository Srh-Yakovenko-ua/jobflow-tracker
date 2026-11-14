import { z } from 'zod';

export const AI_KINDS = [
  'vacancy_parse',
  'resume_parse',
  'match',
  'followup',
  'monthly_summary',
] as const;

export const aiKindSchema = z.enum(AI_KINDS);

export type AiKind = z.infer<typeof aiKindSchema>;

export const AI_PROMPT_VERSIONS = {
  vacancy_parse: 'v2',
  resume_parse: 'v1',
  match: 'v3',
  followup: 'v1',
  monthly_summary: 'v1',
} satisfies Record<AiKind, string>;
