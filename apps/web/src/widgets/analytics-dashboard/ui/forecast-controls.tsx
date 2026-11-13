'use client';

import { useId } from 'react';

import type { ForecastWhatIf } from '@/entities/analytics';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Switch } from '@/shared/ui/switch';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { FORECAST_RATE as RATE, rateOnStep } from '../lib/forecast-rate';
import { oneDecimal } from '../lib/kpi-values';
import type { ForecastWhatIfActions } from '../model/use-forecast-what-if';

const COPY = uk.analytics.blocks.forecast;

export type ForecastControls = Readonly<{ value: ForecastWhatIf; actions: ForecastWhatIfActions }>;

export type ForecastControlsProps = Readonly<{ controls: ForecastControls; observedRate: number }>;

export function ForecastControlsPanel({ controls, observedRate }: ForecastControlsProps) {
  const id = useId();
  const { value, actions } = controls;
  const rate = value.applicationsPerWeek ?? rateOnStep(observedRate);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.75">
        <div className="flex justify-between gap-3 text-[12.5px] text-ink">
          <label htmlFor={id}>{COPY.rate.label}</label>
          <span aria-hidden className="font-semibold tabular-nums">
            {oneDecimal(rate)}
          </span>
        </div>
        <input
          id={id}
          type="range"
          min={RATE.min}
          max={RATE.max}
          step={RATE.step}
          value={rate}
          aria-valuetext={COPY.rate.value(oneDecimal(rate))}
          onChange={(event) => {
            actions.setRate(event.currentTarget.valueAsNumber);
          }}
          className={cn('h-8 w-full cursor-pointer accent-accent', TOUCH_HEIGHT)}
        />
      </div>
      <Switch
        label={<span className="text-[12.5px] text-ink-2">{COPY.tech}</span>}
        checked={value.improve !== undefined}
        onCheckedChange={actions.toggleTech}
      />
    </div>
  );
}
