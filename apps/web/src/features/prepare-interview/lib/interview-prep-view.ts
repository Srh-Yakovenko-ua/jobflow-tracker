import type { InterviewPrepResponse } from '@jobflow/shared';

import { type AiResultView, aiResultViewOf } from '@/entities/application';

export type InterviewPrepResult = NonNullable<InterviewPrepResponse['result']>;

export type InterviewPrepRefusal = 'none' | 'unbuildable' | 'other';

export type InterviewPrepView =
  AiResultView<InterviewPrepResult> | Readonly<{ kind: 'unbuildable' }>;

export type InterviewPrepViewInput = Readonly<{
  response: InterviewPrepResponse;
  refusal: InterviewPrepRefusal;
  requestable: boolean;
}>;

const ASKS_FOR_A_REQUEST: ReadonlySet<InterviewPrepView['kind']> = new Set(['idle', 'failed']);

export function interviewPrepViewOf({
  response,
  refusal,
  requestable,
}: InterviewPrepViewInput): InterviewPrepView {
  if (refusal === 'unbuildable') return { kind: 'unbuildable' };
  const view = aiResultViewOf({ response, refused: refusal !== 'none' });
  return !requestable && ASKS_FOR_A_REQUEST.has(view.kind) ? { kind: 'unbuildable' } : view;
}
