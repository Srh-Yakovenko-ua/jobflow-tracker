import type { ApplicationResponse } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

import { CardFooter } from './card-footer';
import { CARD_FRAME } from './card-frame';
import { CardHeading } from './card-heading';
import { type DraftMark, ReviewMark, TextKeptLine } from './review-mark';
import { ScoreBadge } from './score-badge';

export type PreviewCardProps = Readonly<{
  application: ApplicationResponse;
  view?: { mark?: DraftMark };
}>;

const PREVIEW_LOOK: Record<DraftMark | 'ready', string> = {
  review: 'text-ink inset-ring inset-ring-accent',
  failed: 'text-ink-3 inset-ring inset-ring-rejected',
  ready: 'text-ink shadow-e1',
};

export function PreviewCard({ application, view }: PreviewCardProps) {
  const score = { matchScore: application.matchScore, aiStatus: null };
  const mark = application.isDraft ? (view?.mark ?? 'review') : null;
  return (
    <article
      className={cn(CARD_FRAME.article, 'gap-2.5 bg-surface', PREVIEW_LOOK[mark ?? 'ready'])}
    >
      {mark !== null && <ReviewMark mark={mark} />}
      <CardHeading application={application} badge={<ScoreBadge application={score} />} />
      {mark === 'failed' ? <TextKeptLine /> : <CardFooter application={application} />}
    </article>
  );
}
