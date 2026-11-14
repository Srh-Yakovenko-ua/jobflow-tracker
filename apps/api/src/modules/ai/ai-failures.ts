import {
  type AiKind,
  matchFailure,
  matchOutputSchema,
  vacancyParseFailure,
  vacancyParseOutputSchema,
} from '@jobflow/shared';

import type { AiServiceError } from './ai-service-error.js';

export const OUTPUT_FAILURES: Record<AiKind, (output: unknown) => string | null> = {
  vacancy_parse: (output) => vacancyParseFailure(vacancyParseOutputSchema.parse(output)),
  resume_parse: () => null,
  match: (output) => matchFailure(matchOutputSchema.parse(output)),
  followup: () => null,
  monthly_summary: () => null,
};

export type AiRefusal = { error: AiServiceError; kind: AiKind };

export const FAILED_CALL = {
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
} as const;

const FAILS_AT_ONCE: ReadonlySet<AiKind> = new Set(['followup']);

export function isFinal({ error, kind }: AiRefusal): boolean {
  const refused = error.status >= 400 && error.status < 500 && error.status !== 429;
  return refused || FAILS_AT_ONCE.has(kind);
}
