import { type ActiveStage, activeStageSchema, type TimelineItem } from '@jobflow/shared';

export function reviveTargetOf(items: readonly TimelineItem[]): ActiveStage | null {
  const newestMove = items.find((item) => item.type === 'stage_changed');
  if (newestMove?.meta.toStage !== 'ghosted') return null;
  const target = activeStageSchema.safeParse(newestMove.meta.fromStage);
  return target.success ? target.data : null;
}
