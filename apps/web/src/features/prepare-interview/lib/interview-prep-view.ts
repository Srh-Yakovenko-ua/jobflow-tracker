import type { InterviewPrepResponse } from '@jobflow/shared';

import { type AiResultView, aiResultViewOf } from '@/entities/application';

export type InterviewPrepResult = NonNullable<InterviewPrepResponse['result']>;

export type InterviewPrepRefusal = 'none' | 'unbuildable' | 'other';

export type InterviewPrepView =
  AiResultView<InterviewPrepResult> | Readonly<{ kind: 'unbuildable' }>;

export type InterviewPrepViewInput = Readonly<{
  response: InterviewPrepResponse;
  refusal: InterviewPrepRefusal;
}>;

export function interviewPrepViewOf({
  response,
  refusal,
}: InterviewPrepViewInput): InterviewPrepView {
  if (refusal === 'unbuildable') return { kind: 'unbuildable' };
  return aiResultViewOf({ response, refused: refusal !== 'none' });
}
