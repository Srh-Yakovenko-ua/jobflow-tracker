'use client';

import { motion } from 'motion/react';

import { cn } from '@/shared/lib/cn';
import { useDataTransition } from '@/shared/lib/use-data-transition';

import type { KpiBar, KpiBarTone, KpiChip, KpiContent } from '../lib/kpi-values';

const PERCENT = 100;

const BAR_FILLS: Record<KpiBarTone, string> = {
  screening: 'bg-stage-screening',
  response: 'bg-data-3',
  ghost:
    'bg-[repeating-linear-gradient(90deg,var(--color-ghosted)_0_3px,var(--color-line-soft)_3px_6px)]',
};

const CHIP_TONES: Record<KpiChip['tone'], string> = {
  positive: 'bg-offer/10 text-offer',
  neutral: 'bg-surface-3 text-ink-2',
};

function ShareBar({ bar }: Readonly<{ bar: KpiBar }>) {
  const transition = useDataTransition();
  return (
    <span aria-hidden className="relative block h-1.5 rounded-[3px] bg-line-soft">
      <span className="block h-full overflow-hidden rounded-[3px]">
        <motion.span
          className={cn('block h-full w-full rounded-[3px]', BAR_FILLS[bar.tone])}
          initial={{ x: '-100%' }}
          animate={{ x: `${String(bar.share * PERCENT - PERCENT)}%` }}
          transition={transition}
        />
      </span>
      {bar.marker !== undefined && (
        <span
          className="absolute -top-0.75 h-3 w-0.5 rounded-[1px] bg-withdrawn"
          style={{ left: `${String(bar.marker * PERCENT)}%` }}
        />
      )}
    </span>
  );
}

export type KpiValueProps = Readonly<{ content: KpiContent }>;

export function KpiValue({ content }: KpiValueProps) {
  const { value, unit, chip, bar, caption, quiet } = content;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'font-display text-[38px] leading-none font-semibold tracking-[-0.045em] tabular-nums',
            quiet ? 'text-ink-2' : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit !== undefined && <span className="text-[15px] text-ink-2">{unit}</span>}
        {chip !== undefined && (
          <span
            className={cn(
              'rounded-pill px-2 py-0.5 text-[11.5px] font-semibold tabular-nums',
              CHIP_TONES[chip.tone],
            )}
          >
            {chip.text}
          </span>
        )}
      </div>
      {bar !== undefined && <ShareBar bar={bar} />}
      <span className="text-[12.5px] text-ink-2 tabular-nums">{caption}</span>
    </div>
  );
}
