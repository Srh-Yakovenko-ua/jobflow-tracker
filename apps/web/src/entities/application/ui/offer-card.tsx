import { type ApplicationCard, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { formatDaysInFunnel } from '../lib/days-in-funnel';
import { formatSalaryRange } from '../lib/salary';
import type { ApplicationCardContext } from '../model/card-context';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';

export type OfferCardProps = Readonly<{
  application: ApplicationCard;
  context: ApplicationCardContext;
}>;

const OFFER_LOOK =
  'gap-2.5 bg-linear-160 from-offer/6 to-surface to-55% text-ink shadow-e1 inset-ring inset-ring-offer/25';

function OfferBadge() {
  return (
    <span className="flex-none rounded-pill bg-offer px-2.5 py-0.75 text-[12px] leading-[normal] font-semibold text-surface">
      {STAGE_LABELS.offer.labelUk}
    </span>
  );
}

export function OfferCard({ application, context }: OfferCardProps) {
  const salary = formatSalaryRange(application);
  const { appliedAt } = application;
  return (
    <article className={cn(CARD_FRAME.article, OFFER_LOOK)}>
      <CardHeading application={application} badge={<OfferBadge />} />
      <div className={CARD_FRAME.footer}>
        <span
          className={cn(
            CARD_FRAME.salary,
            salary !== null && 'font-semibold text-offer tabular-nums',
          )}
        >
          {salary ?? uk.application.salary.unknown}
        </span>
        {appliedAt !== null && (
          <span className="tabular-nums">
            {formatDaysInFunnel({ appliedAt, now: context.now, timeZone: context.timeZone })}
          </span>
        )}
      </div>
    </article>
  );
}
