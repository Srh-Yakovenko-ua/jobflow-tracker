'use client';

import { WORK_MODES } from '@jobflow/shared';
import { Info } from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { uk } from '@/shared/i18n';
import { RangeField } from '@/shared/ui/range-field';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { type Comparison, COMPARISON_LIMITS, OFFER_CRITERIA } from '../model/comparison-store';

const COPY = uk.offerCompare.weights;

const MODES = uk.application.workModes;

const WEIGHT_BOUNDS = { min: 0, max: COMPARISON_LIMITS.weightMax, step: 1 } as const;

const MODE_OPTIONS = WORK_MODES.map((mode) => ({ value: mode, label: MODES[mode] }));

function WeightFrame({ children }: Readonly<{ children: ReactNode }>) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e1 max-sm:p-4 print:p-0 print:shadow-none"
    >
      <h2 id={titleId} className="text-[16px] leading-[1.3] font-semibold text-ink">
        {COPY.title}
      </h2>
      {children}
      <p className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink-2">
        <Info aria-hidden size={16} strokeWidth={1.9} className="mt-px flex-none text-ink-3" />
        {COPY.note}
      </p>
    </section>
  );
}

export type WeightPanelProps = Readonly<{
  comparison: Comparison;
  onChange: (next: Comparison) => void;
}>;

export function WeightPanel({ comparison, onChange }: WeightPanelProps) {
  const { weights } = comparison;
  return (
    <WeightFrame>
      <div className="grid min-w-0 gap-x-6 gap-y-3.5 @xl:grid-cols-2 @4xl:grid-cols-3">
        {OFFER_CRITERIA.map((criterion) => (
          <RangeField
            key={criterion}
            label={COPY.criteria[criterion]}
            value={{
              current: weights[criterion],
              shown: String(weights[criterion]),
              spoken: COPY.value(weights[criterion]),
            }}
            bounds={WEIGHT_BOUNDS}
            onValueChange={(weight) => {
              onChange({ ...comparison, weights: { ...weights, [criterion]: weight } });
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-hidden className="text-[12.5px] text-ink">
          {COPY.preferredMode}
        </span>
        <SegmentedControl
          aria-label={COPY.preferredMode}
          options={MODE_OPTIONS}
          value={comparison.preferredMode}
          onValueChange={(preferredMode) => {
            onChange({ ...comparison, preferredMode });
          }}
        />
      </div>
    </WeightFrame>
  );
}

export type WeightSummaryProps = Readonly<{ comparison: Comparison }>;

export function WeightSummary({ comparison }: WeightSummaryProps) {
  return (
    <WeightFrame>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink tabular-nums">
        {OFFER_CRITERIA.map((criterion) => (
          <li key={criterion}>
            {`${COPY.criteria[criterion]}: ${COPY.value(comparison.weights[criterion])}`}
          </li>
        ))}
        <li>{`${COPY.preferredMode}: ${MODES[comparison.preferredMode]}`}</li>
      </ul>
    </WeightFrame>
  );
}
