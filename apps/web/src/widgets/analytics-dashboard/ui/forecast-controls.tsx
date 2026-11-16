'use client';

import type { ForecastWhatIf } from '@/entities/analytics';
import { uk } from '@/shared/i18n';
import { RangeField } from '@/shared/ui/range-field';
import { Switch } from '@/shared/ui/switch';

import { FORECAST_RATE, rateOnStep } from '../lib/forecast-rate';
import { oneDecimal } from '../lib/kpi-values';
import type { ForecastWhatIfActions } from '../model/use-forecast-what-if';

const COPY = uk.analytics.blocks.forecast;

export type ForecastControls = Readonly<{ value: ForecastWhatIf; actions: ForecastWhatIfActions }>;

export type ForecastControlsProps = Readonly<{ controls: ForecastControls; observedRate: number }>;

export function ForecastControlsPanel({ controls, observedRate }: ForecastControlsProps) {
  const { value, actions } = controls;
  const rate = value.applicationsPerWeek ?? rateOnStep(observedRate);
  const shown = oneDecimal(rate);
  return (
    <div className="flex flex-col gap-3.5 print:hidden">
      <RangeField
        label={COPY.rate.label}
        value={{ current: rate, shown, spoken: COPY.rate.value(shown) }}
        bounds={FORECAST_RATE}
        onValueChange={actions.setRate}
      />
      <Switch
        label={<span className="text-[12.5px] text-ink-2">{COPY.tech}</span>}
        checked={value.improve !== undefined}
        onCheckedChange={actions.toggleTech}
      />
    </div>
  );
}
