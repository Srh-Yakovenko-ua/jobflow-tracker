import type { ApplicationResponse } from '@jobflow/shared';
import { useState } from 'react';

import { useNormsQuery } from '@/entities/analytics';
import { useUserTimeZone } from '@/entities/user';

import { contextNormsOf, contextRowsOf } from '../lib/context-rows';

export function useApplicationContext(application: ApplicationResponse) {
  const [mountedAt] = useState(Date.now);
  const timeZone = useUserTimeZone();
  const norms = contextNormsOf({
    norms: useNormsQuery().data,
    stage: application.currentStage,
  });
  return contextRowsOf({ application, now: new Date(mountedAt), timeZone, norms });
}
