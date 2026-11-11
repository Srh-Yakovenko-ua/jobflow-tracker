import type { ApplicationResponse } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

import { CardFooter } from './card-footer';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';
import { DRAFT_MARK_LOOK, type DraftMark, ReviewMark, TextKeptLine } from './review-mark';
import { ScoreBadge } from './score-badge';

export type PreviewCardProps = Readonly<{
  application: ApplicationResponse;
  view?: { mark?: DraftMark };
}>;

const READY_LOOK = 'text-ink shadow-e1';

export function PreviewCard({ application, view }: PreviewCardProps) {
  const score = { matchScore: application.matchScore, aiStatus: null };
  const mark = application.isDraft ? (view?.mark ?? 'review') : null;
  const look = mark === null ? null : DRAFT_MARK_LOOK[mark];
  return (
    <article
      className={cn(
        CARD_FRAME.article,
        'gap-2.5 bg-surface',
        look === null ? READY_LOOK : look.card.preview,
      )}
    >
      {mark !== null && <ReviewMark mark={mark} />}
      <CardHeading application={application} badge={<ScoreBadge application={score} />} />
      {look?.footer === 'kept' ? <TextKeptLine /> : <CardFooter application={application} />}
    </article>
  );
}
