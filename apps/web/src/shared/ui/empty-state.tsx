import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { STATE_TEXT } from './state-text';

const COPY = uk.states.empty;

export type EmptyStateContent = {
  eyebrow?: string;
  title: string;
  hint: string;
  footnote?: string;
};

export type EmptyStateProgress = { count: number; goal: number };

export type EmptyStateSize = 'page' | 'panel' | 'compact';

export type EmptyStateTone = 'plain' | 'ghosted' | 'offer';

export type EmptyStateView = { size?: EmptyStateSize; tone?: EmptyStateTone };

type SizeLook = { frame: string; text: string; title: string; hint: string; figureFirst: boolean };

const SIZES: Record<EmptyStateSize, SizeLook> = {
  page: {
    frame: 'items-start gap-5.5 bg-surface px-9 py-11 shadow-e1',
    text: 'max-w-[54ch] gap-2.5',
    title: 'font-display text-[30px] leading-[1.15] font-medium',
    hint: 'text-[15.5px] leading-[1.6]',
    figureFirst: true,
  },
  panel: {
    frame: 'min-h-61 gap-3.5 bg-surface p-6 shadow-e1',
    text: 'flex-1 gap-2',
    title: 'font-display text-[22px] leading-[1.2]',
    hint: 'text-[14px] leading-[1.55]',
    figureFirst: false,
  },
  compact: {
    frame:
      'items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-line bg-surface px-4 py-5 text-center',
    text: 'items-center gap-2.5',
    title: 'text-[14px] leading-[1.35] font-semibold',
    hint: 'max-w-[34ch] text-[12px] leading-[1.5]',
    figureFirst: true,
  },
};

type ToneLook = { frame?: string; eyebrow: string; title?: string };

const TONES: Record<EmptyStateTone, ToneLook> = {
  plain: { eyebrow: 'text-ink-3' },
  ghosted: {
    frame: 'rounded-[6px] border-[1.5px] border-dashed border-ghosted bg-surface-3 shadow-none',
    eyebrow: 'text-ink-3',
    title: 'text-ink-2',
  },
  offer: { frame: 'shadow-none inset-ring inset-ring-offer', eyebrow: 'text-offer' },
};

export type DashedBarsDensity = 'full' | 'compact';

const DASHED_BARS: Record<DashedBarsDensity, { frame: string; bar: string; heights: string[] }> = {
  full: {
    frame: 'h-11 gap-2.5',
    bar: 'w-7.5 rounded-[6px]',
    heights: [
      'h-full border-line',
      'h-[66%] border-line',
      'h-[44%] border-line-soft',
      'h-[26%] border-line-soft',
    ],
  },
  compact: {
    frame: 'h-7.5 gap-1.25',
    bar: 'w-4 rounded-[4px]',
    heights: ['h-full border-line', 'h-[66%] border-line', 'h-[40%] border-line-soft'],
  },
};

export type DashedBarsProps = Readonly<{ view?: { density?: DashedBarsDensity } }>;

export function DashedBars({ view }: DashedBarsProps) {
  const look = DASHED_BARS[view?.density ?? 'full'];
  return (
    <div aria-hidden className={cn('flex items-end', look.frame)}>
      {look.heights.map((height) => (
        <span key={height} className={cn('border-[1.5px] border-dashed', look.bar, height)} />
      ))}
    </div>
  );
}

function ProgressMeter({ progress }: Readonly<{ progress: EmptyStateProgress }>) {
  const { count, goal } = progress;
  const filled = Math.min(count, goal);
  const segments = Array.from({ length: goal }, (_, position) => ({
    id: `segment-${String(position)}`,
    filled: position < filled,
  }));
  return (
    <>
      <div
        role="meter"
        aria-label={COPY.meterLabel}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={filled}
        aria-valuetext={COPY.meter(count, goal)}
        className="flex gap-0.75 self-stretch"
      >
        {segments.map((segment) => (
          <span
            key={segment.id}
            className={cn(
              'h-2 flex-1 rounded-pill',
              segment.filled ? 'bg-stage-screening' : 'bg-line-soft',
            )}
          />
        ))}
      </div>
      <span aria-hidden className={STATE_TEXT.meta}>
        {COPY.meter(count, goal)}
      </span>
    </>
  );
}

function ActionRow({ action }: Readonly<{ action: ReactNode }>) {
  if (!action) return null;
  return <div className="flex max-w-full min-w-0 flex-wrap gap-2.5">{action}</div>;
}

export type EmptyStateSlots = { figure?: ReactNode; action?: ReactNode };

export type EmptyStateProps = Readonly<{
  content: EmptyStateContent;
  progress?: EmptyStateProgress;
  slots?: EmptyStateSlots;
  view?: EmptyStateView;
}>;

export function EmptyState({ content, progress, slots = {}, view = {} }: EmptyStateProps) {
  const { figure, action } = slots;
  const size = SIZES[view.size ?? 'panel'];
  const tone = TONES[view.tone ?? 'plain'];
  return (
    <div className={cn('flex min-w-0 flex-col', size.frame, tone.frame)}>
      {size.figureFirst && figure}
      {content.eyebrow && (
        <span className={cn(STATE_TEXT.eyebrow, tone.eyebrow)}>{content.eyebrow}</span>
      )}
      <div className={cn('flex flex-col', size.text)}>
        <h2 className={cn('wrap-break-word text-ink', size.title, tone.title)}>{content.title}</h2>
        <p className={cn('text-ink-2', size.hint)}>{content.hint}</p>
      </div>
      {!size.figureFirst && figure}
      {progress && <ProgressMeter progress={progress} />}
      <ActionRow action={action} />
      {content.footnote && <span className={STATE_TEXT.meta}>{content.footnote}</span>}
    </div>
  );
}
