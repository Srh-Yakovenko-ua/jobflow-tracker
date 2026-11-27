import type { ApplicationResponse, ResumeVersionListResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { isProfileReading, resumeVersionsQueryOptions } from '@/entities/resume';
import { useLivePollMs } from '@/shared/api';

export function useLinkedVersion({ resumeVersionId }: ApplicationResponse) {
  const pollMs = useLivePollMs();
  const linkedOf = ({ items }: ResumeVersionListResponse) =>
    items.find(({ id }) => id === resumeVersionId);
  const { data } = useQuery({
    ...resumeVersionsQueryOptions(),
    enabled: resumeVersionId !== null,
    select: linkedOf,
    refetchInterval: ({ state }) =>
      state.data !== undefined && isProfileReading(linkedOf(state.data)?.aiProfileStatus)
        ? pollMs
        : false,
  });
  return data;
}
