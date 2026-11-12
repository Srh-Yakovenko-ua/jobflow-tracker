import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { resumeVersionsQueryOptions } from '@/entities/resume';

import { sectionLoadOf } from './section-load';
import { useDayLabel } from './use-day-label';
import { useLinkedVersion } from './use-linked-version';

export function useAttachedResume(application: ApplicationResponse) {
  const versions = useQuery(resumeVersionsQueryOptions());
  const linked = useLinkedVersion(application) ?? null;
  const dayLabel = useDayLabel();
  return {
    load: sectionLoadOf(versions),
    versions: versions.data?.items ?? [],
    linked,
    dayLabel,
  };
}

export type AttachedResumeState = ReturnType<typeof useAttachedResume>;
