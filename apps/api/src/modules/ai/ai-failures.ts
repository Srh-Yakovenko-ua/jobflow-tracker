import { type AiKind, vacancyParseFailure, vacancyParseOutputSchema } from '@jobflow/shared';

import type { AiServiceError } from './ai-service-error.js';

export const OUTPUT_FAILURES: Record<AiKind, (output: unknown) => string | null> = {
  vacancy_parse: (output) => vacancyParseFailure(vacancyParseOutputSchema.parse(output)),
  resume_parse: () => null,
};

export const FAILED_CALL = {
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
} as const;

export function isFinal(error: AiServiceError): boolean {
  return error.status >= 400 && error.status < 500 && error.status !== 429;
}
