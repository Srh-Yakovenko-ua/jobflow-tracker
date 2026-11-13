import {
  REJECTION_REASONS,
  type RejectionReasonCode,
  type Stage,
  STAGE_LABELS,
} from '@jobflow/shared';

import { sankeyFlowLine } from '@/shared/lib/chart';

export type RejectionBar = Readonly<{ reason: RejectionReasonCode; count: number }>;

export const REJECTION_BARS: readonly RejectionBar[] = [
  { reason: 'chose_other', count: 10 },
  { reason: 'no_explanation', count: 6 },
  { reason: 'position_closed', count: 4 },
  { reason: 'skills_gap', count: 4 },
  { reason: 'english_level', count: 3 },
  { reason: 'salary_expectations', count: 5 },
];

export type FunnelFlow = Readonly<{ from: Stage; to: Stage; flow: number }>;

export const FUNNEL_FLOWS: readonly FunnelFlow[] = [
  { from: 'applied', to: 'screening', flow: 14 },
  { from: 'applied', to: 'rejected', flow: 8 },
  { from: 'applied', to: 'ghosted', flow: 10 },
  { from: 'screening', to: 'tech_interview', flow: 8 },
  { from: 'screening', to: 'rejected', flow: 4 },
  { from: 'screening', to: 'ghosted', flow: 2 },
  { from: 'tech_interview', to: 'offer', flow: 2 },
  { from: 'tech_interview', to: 'rejected', flow: 6 },
];

export const FUNNEL_NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_LABELS).map(([stage, label]) => [stage, label.labelUk]),
);

export function reasonLines(reason: RejectionReasonCode): string[] {
  const words = REJECTION_REASONS[reason].labelUk.split(' ');
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean);
}

export const REJECTION_SUMMARY = REJECTION_BARS.map(
  ({ reason, count }) => `${REJECTION_REASONS[reason].labelUk} ${String(count)}`,
).join(', ');

export const FUNNEL_SUMMARY = FUNNEL_FLOWS.map(sankeyFlowLine).join(', ');
