import type { ApplicationResponse } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

import { CardFooter } from './card-footer';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';
import { ReviewMark } from './review-mark';
import { ScoreBadge } from './score-badge';

export type PreviewCardProps = Readonly<{ application: ApplicationResponse }>;

export function PreviewCard({ application }: PreviewCardProps) {
  const score = { matchScore: application.matchScore, aiStatus: null };
  return (
    <article
      className={cn(
        CARD_FRAME.article,
        'gap-2.5 bg-surface text-ink',
        application.isDraft ? 'inset-ring inset-ring-accent' : 'shadow-e1',
      )}
    >
      {application.isDraft && <ReviewMark />}
      <CardHeading application={application} badge={<ScoreBadge application={score} />} />
      <CardFooter application={application} />
    </article>
  );
}
