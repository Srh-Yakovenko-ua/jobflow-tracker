import { useState } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';

export type DayLabel = (at: string) => string;

export function useDayLabel(): DayLabel {
  const timeZone = useUserTimeZone();
  const [mountedAt] = useState(Date.now);
  return (at) => formatTimelineDate({ at: new Date(at), now: new Date(mountedAt), timeZone });
}
