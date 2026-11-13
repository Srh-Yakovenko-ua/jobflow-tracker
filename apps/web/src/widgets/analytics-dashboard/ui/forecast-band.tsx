import type { CSSProperties } from 'react';

import { cn } from '@/shared/lib/cn';

import type { ForecastBand as Band, ForecastSpan } from '../lib/forecast-view';

export const FORECAST_STRIPES =
  'bg-[repeating-linear-gradient(90deg,color-mix(in_oklab,var(--color-accent)_35%,var(--color-surface))_0_4px,color-mix(in_oklab,var(--color-accent)_15%,var(--color-surface))_4px_8px)]';

const GLIDE =
  'absolute block transition-[left,width] duration-(--duration-base) ease-standard motion-reduce:transition-none';

const placed = ({ left, width }: ForecastSpan): CSSProperties => ({
  left: `${String(left)}%`,
  width: `${String(width)}%`,
});

export type ForecastBandProps = Readonly<{ band: Band }>;

export function ForecastBand({ band }: ForecastBandProps) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <span className="relative block h-8.5 shadow-[inset_0_-1px_0_var(--color-line)]">
        <span
          className={cn(GLIDE, 'top-2.5 h-3.5 rounded-[7px]', FORECAST_STRIPES)}
          style={placed(band.interval)}
        />
        <span
          className={cn(GLIDE, 'top-1 h-6.5 rounded-[7px] bg-accent')}
          style={placed(band.likely)}
        />
        <span
          className={cn(GLIDE, 'top-0 h-8.5 w-0.5 rounded-[1px] bg-ink')}
          style={{ left: `min(${String(band.median)}%, calc(100% - 2px))` }}
        />
      </span>
      <div className="flex justify-between text-[11px] text-ink-3 tabular-nums">
        {band.ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}
