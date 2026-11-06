import {
  REJECTION_REASONS,
  type RejectionReasonCode,
  rejectionReasonCodeSchema,
  type RejectionReasonsSummary,
} from '@jobflow/shared';

import type { ReasonCount } from './application-list.repository.js';

type ReasonTally = RejectionReasonsSummary['reasons'][number];

function byCountThenSortOrder(left: ReasonTally, right: ReasonTally): number {
  return right.count === left.count
    ? REJECTION_REASONS[left.code].sortOrder - REJECTION_REASONS[right.code].sortOrder
    : right.count - left.count;
}

export function reasonTalliesOf(rows: ReasonCount[]): ReasonTally[] {
  const counts = new Map<RejectionReasonCode, number>();
  for (const { reasonCode, count } of rows) {
    const code = rejectionReasonCodeSchema.parse(reasonCode ?? 'unspecified');
    counts.set(code, (counts.get(code) ?? 0) + count);
  }
  return [...counts].map(([code, count]) => ({ code, count })).sort(byCountThenSortOrder);
}
