'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { useApplicationAiRequest } from '@/entities/application';
import { apiStatusOf, HTTP_STATUS, isIdempotencyConflict } from '@/shared/api';

import type { InterviewPrepRefusal } from '../lib/interview-prep-view';

export type RequestedInterviewPrep = Readonly<{
  isPending: boolean;
  refusal: InterviewPrepRefusal;
  request: () => void;
}>;

function refusalOf(error: Error | null): InterviewPrepRefusal {
  if (error === null) return 'none';
  const unbuildable = apiStatusOf(error) === HTTP_STATUS.conflict && !isIdempotencyConflict(error);
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
