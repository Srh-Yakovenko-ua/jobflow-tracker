'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { useApplicationAiRequest } from '@/entities/application';
import { ApiError, isIdempotencyConflict } from '@/shared/api';

import type { InterviewPrepRefusal } from '../lib/interview-prep-view';

export type RequestedInterviewPrep = Readonly<{
  isPending: boolean;
  refusal: InterviewPrepRefusal;
  request: () => void;
}>;

const CONFLICT = 409;

function refusalOf(error: Error | null): InterviewPrepRefusal {
  if (error === null) return 'none';
  const unbuildable =
    error instanceof ApiError && error.status === CONFLICT && !isIdempotencyConflict(error);
  return unbuildable ? 'unbuildable' : 'other';
}

export function useRequestInterviewPrep(
  applicationId: ApplicationResponse['id'],
): RequestedInterviewPrep {
  const mutation = useApplicationAiRequest({ applicationId, segment: 'interview-prep' });
  return {
    isPending: mutation.isPending,
    refusal: refusalOf(mutation.error),
    request: () => {
      mutation.mutate();
    },
  };
}
