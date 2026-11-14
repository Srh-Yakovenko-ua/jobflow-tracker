import type {
  EvidenceView,
  IntervalBarRow,
  NoteLine,
  PlottedEvidence,
} from '@/widgets/analytics-dashboard/lib/interval-bars';

import { rowTexts } from './table-rows';

export function plottedOf(view: EvidenceView): PlottedEvidence {
  if (view.status !== 'plotted') throw new Error(`expected a plotted view, got ${view.status}`);
  return view;
}

export function barsOf(view: EvidenceView) {
  return plottedOf(view).chart.rows.map(({ label, value, whisker }: IntervalBarRow) => [
    label.join(' / '),
    value,
    whisker,
  ]);
}

export function textsOf(lines: readonly NoteLine[]): string[] {
  return lines.map(({ text }) => text);
}

export function tableOf(view: EvidenceView): string[][] {
  return rowTexts(plottedOf(view).table.rows);
}
