import { type ApplicationCard, SOURCE_LABELS } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { formatSalaryRange, type SalarySource } from '../lib/salary';
import { CARD_FRAME } from './card-frame';

export type CardFooterProps = Readonly<{
  application: SalarySource & Pick<ApplicationCard, 'source'>;
  view?: { muted?: boolean };
  aside?: ReactNode;
}>;

export function CardFooter({ application, view, aside }: CardFooterProps) {
  const salary = formatSalaryRange(application);
  return (
    <div className={CARD_FRAME.footer}>
      <span
        className={cn(
          CARD_FRAME.salary,
          salary !== null && 'tabular-nums',
          salary !== null && view?.muted !== true && 'font-medium',
        )}
      >
        {salary ?? uk.application.salary.unknown}
      </span>
      {aside ?? (
        <span className="text-[10.5px] font-semibold tracking-[0.06em] uppercase">
          {SOURCE_LABELS[application.source].labelUk}
        </span>
      )}
    </div>
  );
}
