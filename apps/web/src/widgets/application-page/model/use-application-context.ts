import type { ApplicationResponse } from '@jobflow/shared';

import { useNormsQuery } from '@/entities/analytics';
import { useUserTimeZone } from '@/entities/user';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { useQueryNow } from '@/shared/lib/use-query-now';

import { contextNormsOf, contextRowsOf } from '../lib/context-rows';

export function useApplicationContext(application: ApplicationResponse) {
  const timeZone = useUserTimeZone();
  const normsQuery = useNormsQuery();
  const now = useQueryNow(normsQuery);
  const norms = contextNormsOf({ norms: normsQuery.data, stage: application.currentStage });
  return {
    rows: contextRowsOf({ application, now, timeZone, norms }),
    load: sectionLoadOf(normsQuery),
  };
}
