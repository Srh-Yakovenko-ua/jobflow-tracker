import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { STATE_TEXT } from '@/shared/ui/state-text';

import { CARD_FRAME } from './card-frame';

export type DraftMark = 'review' | 'failed';

export type ReviewMarkProps = Readonly<{ mark: DraftMark }>;

type MarkLook = Readonly<{ tone: string; dot: ReactNode; label: string }>;

const COPY = uk.application.parsing;

const MARK_LOOK: Record<DraftMark, MarkLook> = {
  review: {
    tone: 'text-link',
    dot: <span aria-hidden className={CARD_FRAME.dot} />,
    label: COPY.review,
  },
  failed: {
    tone: 'text-danger',
    dot: (
      <span
        aria-hidden
        className="flex size-2 flex-none items-center justify-center rounded-pill border-[1.5px] border-rejected"
      >
        <span className="h-[1.5px] w-1 bg-rejected" />
      </span>
    ),
    label: COPY.failed,
  },
};

export function ReviewMark({ mark }: ReviewMarkProps) {
  const look = MARK_LOOK[mark];
  return (
    <span className={cn(CARD_FRAME.eyebrow, look.tone)}>
      {look.dot}
      {look.label}
    </span>
  );
}

export function TextKeptLine() {
  return <span className={STATE_TEXT.meta}>{COPY.textKept}</span>;
}
