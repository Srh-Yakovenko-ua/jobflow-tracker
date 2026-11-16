import {
  AI_PROMPT_VERSIONS,
  type AiKind,
  matchFailure,
  matchOutputSchema,
  vacancyParseFailure,
  vacancyParseOutputSchema,
} from '@jobflow/shared';

import type { AiCallRecord } from './ai-call-row.js';
import type { SaveAiFailure } from './ai-result-row.js';
import type { AiRun } from './ai-run.js';
import type { AiServiceError } from './ai-service-error.js';

export const OUTPUT_FAILURES: Record<AiKind, (output: unknown) => string | null> = {
  vacancy_parse: (output) => vacancyParseFailure(vacancyParseOutputSchema.parse(output)),
  resume_parse: () => null,
  match: (output) => matchFailure(matchOutputSchema.parse(output)),
  followup: () => null,
  monthly_summary: () => null,
  cv_hints: () => null,
  interview_prep: () => null,
};

export type AiRefusal = { error: AiServiceError; kind: AiKind };

export const FAILED_CALL = {
  model: '',
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
} as const;

export function failedCallOf({ job, now }: AiRun, errorType: string): AiCallRecord {
  return { kind: job.kind, status: 'failed', errorType, now, ...FAILED_CALL };
}

export function failedResultOf({ job, inputHash, now }: AiRun, errorType: string): SaveAiFailure {
  const promptVersion = AI_PROMPT_VERSIONS[job.kind];
  return { kind: job.kind, inputHash, promptVersion, error: errorType, now, ...FAILED_CALL };
}

const FAILS_AT_ONCE: ReadonlySet<AiKind> = new Set(['followup', 'cv_hints']);

export function isFinal({ error, kind }: AiRefusal): boolean {
  const refused = error.status >= 400 && error.status < 500 && error.status !== 429;
  return refused || FAILS_AT_ONCE.has(kind);
}
