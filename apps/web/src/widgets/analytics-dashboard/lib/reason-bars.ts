import {
  type ReasonsResponse,
  REJECTION_REASON_CODES,
  REJECTION_REASONS,
  type RejectionReasonCode,
  type RejectionSide,
  STAGE_LABELS,
  type StageReasons,
} from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import { rateLabelOf } from './rate-label';

const COPY = uk.analytics.blocks.reasons;

export const REJECTED_BOARD_HREF = withSearchParams('/board', { stage: ['rejected'] });

export type StatedSide = Exclude<RejectionSide, 'system'>;

export type ReasonBar = Readonly<{
  code: RejectionReasonCode;
  label: string;
  stack: StatedSide;
  data: number[];
  tips: string[][];
}>;

export type ReasonBars = Readonly<{
  labels: string[];
  datasets: ReasonBar[];
  rows: ChartTableRow[];
}>;

type StageReason = StageReasons['reasons'][number];

type ReasonSeries = Readonly<{ stages: readonly StageReasons[]; code: RejectionReasonCode }>;

function statedSide(code: RejectionReasonCode): StatedSide | null {
  const { side } = REJECTION_REASONS[code];
  return side === 'system' ? null : side;
}

function tipOf({ code, count, share }: StageReason): string[] {
  const line = COPY.tooltip.count(REJECTION_REASONS[code].labelUk, count);
  return share.status === 'ok' ? [line, COPY.tooltip.share(rateLabelOf(share))] : [line];
}

function seriesOf({ stages, code }: ReasonSeries): ReasonBar[] {
  const stack = statedSide(code);
  const entries = stages.map(({ reasons }) => reasons.find((reason) => reason.code === code));
  if (stack === null || entries.every((entry) => entry === undefined)) return [];
  const data = entries.map((entry) => entry?.count ?? 0);
  const total = data.reduce((sum, count) => sum + count, 0);
  return [
    {
      code,
      stack,
      label: `${REJECTION_REASONS[code].labelUk} ${String(total)}`,
      data,
      tips: entries.map((entry) => (entry === undefined ? [] : tipOf(entry))),
    },
  ];
}

function rowsOf(stage: StageReasons): ChartTableRow[] {
  const stageName = STAGE_LABELS[stage.stage].labelUk;
  return stage.reasons.flatMap(({ code, count, share }) => {
    const side = statedSide(code);
    if (side === null) return [];
    const cells = [
      { text: stageName },
      { text: COPY.sides[side] },
      { text: REJECTION_REASONS[code].labelUk, href: REJECTED_BOARD_HREF },
      { text: String(count) },
      { text: rateLabelOf(share) },
    ];
    return [{ key: `${stage.stage}:${code}`, cells }];
  });
}

function bySortOrder(left: RejectionReasonCode, right: RejectionReasonCode): number {
  return REJECTION_REASONS[left].sortOrder - REJECTION_REASONS[right].sortOrder;
}

export function reasonBarsOf({ stages }: ReasonsResponse): ReasonBars {
  return {
    labels: stages.map(({ stage }) => STAGE_LABELS[stage].labelUk),
    datasets: [...REJECTION_REASON_CODES]
      .sort(bySortOrder)
      .flatMap((code) => seriesOf({ stages, code })),
    rows: stages.flatMap(rowsOf),
  };
}
