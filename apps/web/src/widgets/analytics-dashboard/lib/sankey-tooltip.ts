import type { FunnelStage, SankeyLink } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { sankeyFlowLine, sankeyStepName } from '@/shared/lib/chart';

import { percentOf } from './kpi-values';

const TIP = uk.analytics.blocks.sankey.tooltip;

export type SankeyTooltipInput = Readonly<{
  link: SankeyLink;
  stages: readonly FunnelStage[] | undefined;
}>;

export type StageStep = Readonly<{ stage: FunnelStage; next: FunnelStage | undefined }>;

export function conversionLine({ stage, next }: StageStep): string | null {
  const { conversion } = stage;
  if (conversion === null || next === undefined) return null;
  if (conversion.status !== 'ok') return conversion.message;
  const step = sankeyStepName({ from: stage.stage, to: next.stage });
  const { value, low, high } = conversion;
  return TIP.conversion({
    step,
    value: percentOf(value),
    low: percentOf(low),
    high: percentOf(high),
  });
}

function stageLines(step: StageStep): string[] {
  const { reached, passed } = step.stage;
  const counts = passed === null ? [] : [TIP.reached(reached, passed)];
  const rate = conversionLine(step);
  return rate === null ? counts : [...counts, rate];
}

function flowStageLines({ link, stages = [] }: SankeyTooltipInput): string[] {
  const index = stages.findIndex((entry) => entry.stage === link.from);
  const stage = stages[index];
  return stage === undefined ? [] : stageLines({ stage, next: stages[index + 1] });
}

export function sankeyTooltipLines(input: SankeyTooltipInput): string[] {
  const flow = sankeyFlowLine(input.link);
  return input.link.ghost ? [flow, TIP.ghost] : [flow, ...flowStageLines(input)];
}
