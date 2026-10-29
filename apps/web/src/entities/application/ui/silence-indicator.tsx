import { type ApplicationCard, countedUk, DAY_FORMS_UK } from '@jobflow/shared';
import { CircleDashed } from 'lucide-react';

import { uk } from '@/shared/i18n';

export type SilenceIndicatorProps = Readonly<{
  application: Pick<ApplicationCard, 'daysSinceLastEvent' | 'silenceLevel'>;
}>;

export function SilenceIndicator({ application }: SilenceIndicatorProps) {
  if (application.silenceLevel === 'none') {
    return null;
  }
  return (
    <span className="flex flex-none items-center gap-1.5 tabular-nums">
      <CircleDashed aria-hidden size={14} className="flex-none text-ghosted" />
      {uk.application.silence(countedUk(application.daysSinceLastEvent, DAY_FORMS_UK))}
    </span>
  );
}
