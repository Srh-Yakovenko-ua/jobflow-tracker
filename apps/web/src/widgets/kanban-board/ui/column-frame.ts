import type { OutcomeStage } from '@jobflow/shared';

type StripLook = { lane: string; label: string; chevron: string };

const RAISED_STRIP: StripLook = {
  lane: 'bg-surface-3',
  label: 'text-ink-2',
  chevron: 'text-ink-2 shadow-e1',
};

export const STRIP_LOOK: Record<OutcomeStage, StripLook> = {
  rejected: RAISED_STRIP,
  ghosted: {
    lane: 'bg-paper inset-ring inset-ring-line-soft',
    label: 'text-ink-3',
    chevron: 'text-ink-3 inset-ring inset-ring-line-soft',
  },
  withdrawn: RAISED_STRIP,
};

export const BOARD_FRAME = {
  width: 'mx-auto max-w-[1388px]',
  toolbar: 'flex min-h-11 flex-wrap items-center justify-between gap-x-4.5 gap-y-2 px-1 pb-2',
} as const;

export const COLUMN_FRAME = {
  column: 'relative flex min-w-62.5 flex-1 flex-col gap-2.5 rounded-2xl bg-surface-3 p-3',
  offer: 'bg-linear-180 from-offer/8 to-surface-3 to-60%',
  header: 'flex items-center gap-2 px-0.5 text-[13px] leading-[normal] font-semibold text-ink',
  drop: 'duration-(--duration-fast) data-[drop=refused]:opacity-50 motion-safe:transition-opacity',
  scroller: '-mx-3 -my-1 max-h-[calc(100dvh-16rem)] overflow-y-auto overscroll-contain px-3 py-1',
  hint: 'text-center text-[11px] text-ink-3 tabular-nums',
} as const;
