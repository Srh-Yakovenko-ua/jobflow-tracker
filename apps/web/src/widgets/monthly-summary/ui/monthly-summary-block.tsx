'use client';

import { useMonthlySummary } from '../model/use-monthly-summary';
import { SummaryStateView } from './summary-state-view';

export function MonthlySummaryBlock() {
  const monthly = useMonthlySummary();
  return (
    <SummaryStateView
      state={monthly.state}
      view={{ mode: 'block', regenerate: true }}
      onRetry={monthly.retry}
    />
  );
}
