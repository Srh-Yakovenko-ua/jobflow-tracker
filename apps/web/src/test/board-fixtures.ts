import {
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type Stage,
  STAGES,
} from '@jobflow/shared';

export type ColumnCounts = Partial<Record<Stage, number>>;

export function boardOf(counts: ColumnCounts): ApplicationBoardResponse {
  return applicationBoardResponseSchema.parse({
    columns: Object.fromEntries(
      STAGES.map((stage) => [stage, { count: counts[stage] ?? 0, items: null }]),
    ),
  });
}
