import type { FunnelStage, SankeyLink } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { sankeyFlowLine, sankeyStepName } from '@/shared/lib/chart';

import { percentOf } from './kpi-values';

const TIP = uk.analytics.blocks.sankey.tooltip;

export type SankeyTooltipInput = Readonly<{
  link: SankeyLink;
  stages: readonly FunnelStage[] | undefined;
}>;

type StageStep = Readonly<{ stage: FunnelStage; next: FunnelStage | undefined }>;

function rateLines({ stage, next }: StageStep): string[] {
  const { conversion } = stage;
  if (conversion === null || next === undefined) return [];
  if (conversion.status !== 'ok') return [conversion.message];
  const step = sankeyStepName({ from: stage.stage, to: next.stage });
  const { value, low, high } = conversion;
  return [
    TIP.conversion({ step, value: percentOf(value), low: percentOf(low), high: percentOf(high) }),
  ];
}

function stageLines(step: StageStep): string[] {
  const { reached, passed } = step.stage;
  const counts = passed === null ? [] : [TIP.reached(reached, passed)];
  return [...counts, ...rateLines(step)];
}

export function sankeyTooltipLines({ link, stages = [] }: SankeyTooltipInput): string[] {
  const index = stages.findIndex((entry) => entry.stage === link.from);
  const stage = stages[index];
  return [
    sankeyFlowLine(link),
    ...(stage === undefined ? [] : stageLines({ stage, next: stages[index + 1] })),
    ...(link.ghost ? [TIP.ghost] : []),
  ];
}
