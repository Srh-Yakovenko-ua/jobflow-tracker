import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { sectionLoadOf } from '@/entities/application';
import { conversionOf, resumeAbQueryOptions, resumeVersionsQueryOptions } from '@/entities/resume';

import { useDayLabel } from './use-day-label';
import { useLinkedVersion } from './use-linked-version';

export function useAttachedResume(application: ApplicationResponse) {
  const versions = useQuery(resumeVersionsQueryOptions());
  const ab = useQuery(resumeAbQueryOptions());
  const linked = useLinkedVersion(application) ?? null;
  const dayLabel = useDayLabel();
  return {
    load: sectionLoadOf(versions),
    versions: versions.data?.items ?? [],
    linked,
    conversion:
      linked === null
        ? 'none'
        : conversionOf({ versions: ab.data?.versions, versionId: linked.id }),
    dayLabel,
  };
}

export type AttachedResumeState = ReturnType<typeof useAttachedResume>;
