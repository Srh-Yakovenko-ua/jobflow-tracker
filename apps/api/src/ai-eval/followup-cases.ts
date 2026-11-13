import { type FollowupInput, followupInputSchema } from '@jobflow/shared';

import { type EvalCase, loadEvalCases } from './eval-cases.js';

export type FollowupEvalCase = EvalCase<FollowupInput>;

export function loadFollowupCases(casesDir: string): Promise<FollowupEvalCase[]> {
  return loadEvalCases(casesDir, followupInputSchema.strict());
}
