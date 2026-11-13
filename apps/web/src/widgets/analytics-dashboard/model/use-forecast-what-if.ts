'use client';

import type { ForecastQuery } from '@jobflow/shared';
import { useState } from 'react';

import type { ForecastWhatIf } from '@/entities/analytics';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

export const FORECAST_DEBOUNCE_MS = 150;

export const TECH_IMPROVE = 'tech_interview:0.6' as const satisfies NonNullable<
  ForecastQuery['improve']
>;

const NO_WHAT_IF: ForecastWhatIf = {};

type WhatIfState = Readonly<{ searchId: string | undefined; whatIf: ForecastWhatIf }>;

export type ForecastWhatIfActions = Readonly<{
  setRate: (applicationsPerWeek: number) => void;
  toggleTech: () => void;
}>;

export function useForecastWhatIf(searchId: string | undefined) {
  const [state, setState] = useState<WhatIfState>({ searchId, whatIf: NO_WHAT_IF });
  const debounced = useDebouncedValue(state, FORECAST_DEBOUNCE_MS);
  const own = ({ searchId: setFor, whatIf }: WhatIfState) =>
    setFor === searchId ? whatIf : NO_WHAT_IF;
  const whatIf = own(state);
  const change = (patch: ForecastWhatIf) => {
    setState({ searchId, whatIf: { ...whatIf, ...patch } });
  };
  const actions: ForecastWhatIfActions = {
    setRate: (applicationsPerWeek) => {
      change({ applicationsPerWeek });
    },
    toggleTech: () => {
      change({ improve: whatIf.improve === undefined ? TECH_IMPROVE : undefined });
    },
  };
  return { whatIf, sent: own(debounced), actions };
}
