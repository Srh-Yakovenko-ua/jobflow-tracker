import { type ApplicationBoardResponse, type Stage, STAGE_LABELS } from '@jobflow/shared';

import { StageMarker } from '@/entities/application';
import { cn } from '@/shared/lib/cn';

export type ColumnHead<S extends Stage = Stage> = Pick<
  ApplicationBoardResponse['columns'][Stage],
  'count'
> & { stage: S };

export type ColumnTitleProps = Readonly<{ column: ColumnHead }>;

export function ColumnTitle({ column }: ColumnTitleProps) {
  const { stage, count } = column;
  return (
    <>
      <span className="me-auto flex min-w-0 items-center gap-2.25">
        <StageMarker stage={stage} />
        {STAGE_LABELS[stage].labelUk}
      </span>{' '}
      <span
        className={cn(
          'rounded-pill bg-surface px-2 py-0.5 text-[12px] font-normal text-ink-3 tabular-nums',
          stage === 'offer' && 'font-semibold text-offer',
        )}
      >
        {count}
      </span>
    </>
  );
}
