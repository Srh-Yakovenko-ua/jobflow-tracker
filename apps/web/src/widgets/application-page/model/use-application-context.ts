import type { ApplicationResponse } from '@jobflow/shared';
import { useState } from 'react';

import { useUserTimeZone } from '@/entities/user';

import { contextRowsOf, NO_NORMS } from '../lib/context-rows';

export function useApplicationContext(application: ApplicationResponse) {
  const [mountedAt] = useState(Date.now);
  const timeZone = useUserTimeZone();
  return contextRowsOf({ application, now: new Date(mountedAt), timeZone, norms: NO_NORMS });
}
