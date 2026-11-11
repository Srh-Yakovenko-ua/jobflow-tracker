import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { STATE_TEXT } from '@/shared/ui/state-text';

import { CARD_FRAME } from './card-frame';

export type DraftMark = 'review' | 'failed';

export type ReviewMarkProps = Readonly<{ mark: DraftMark }>;

type DraftMarkLook = Readonly<{
  tone: string;
  dot: ReactNode;
  label: string;
  card: Readonly<{ board: string; preview: string }>;
  footer: 'kept' | 'fields';
}>;

const COPY = uk.application.parsing;

const FAILED_RING = 'text-ink-3 inset-ring inset-ring-rejected';

export const DRAFT_MARK_LOOK: Record<DraftMark, DraftMarkLook> = {
  review: {
    tone: 'text-link',
    dot: <span aria-hidden className={CARD_FRAME.dot} />,
    label: COPY.review,
    card: {
      board: 'inset-ring inset-ring-accent/25',
      preview: 'text-ink inset-ring inset-ring-accent',
    },
    footer: 'fields',
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
    card: { board: FAILED_RING, preview: FAILED_RING },
    footer: 'kept',
  },
};

export function ReviewMark({ mark }: ReviewMarkProps) {
  const look = DRAFT_MARK_LOOK[mark];
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
