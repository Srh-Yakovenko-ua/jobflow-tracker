import { type ApplicationListItem, SOURCE_LABELS, STAGE_LABELS } from '@jobflow/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  formatSalaryRange,
  ScoreBadge,
  SilenceIndicator,
  StageMarker,
} from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDayMonthYear } from '@/shared/lib/state-format';

import type { DataColumnId } from '../model/columns';
import { TABLE_LOOK } from './table-look';

const COPY = uk.applicationsTable;

export const ROW_LINK = 'a[data-row-link]';

const TRUNCATE = 'block truncate';

export type CellSource = Readonly<{ application: ApplicationListItem; timeZone: string }>;

function DayCell({ iso, timeZone }: Readonly<{ iso: string | null; timeZone: string }>) {
  if (iso === null) {
    return <span className={TABLE_LOOK.muted}>{COPY.noValue}</span>;
  }
  return (
    <span className="block truncate text-ink-2 tabular-nums">
      {formatDayMonthYear({ at: new Date(iso), timeZone })}
    </span>
  );
}

function VacancyCell({ application }: CellSource) {
  return (
    <span className="flex min-w-0 flex-col gap-px">
      <Link
        href={`/applications/${application.id}`}
        scroll={false}
        prefetch={false}
        data-row-link
        className={cn(
          TRUNCATE,
          'w-fit max-w-full rounded-xs font-medium text-ink focus-visible:focus-ring',
        )}
      >
        {application.company}
      </Link>
      <span className={cn(TRUNCATE, 'text-[11.5px] text-ink-3')}>{application.position}</span>
    </span>
  );
}

function StageCell({ application }: CellSource) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StageMarker stage={application.currentStage} />
      <span className={cn(TRUNCATE, 'text-ink-2')}>
        {STAGE_LABELS[application.currentStage].labelUk}
      </span>
    </span>
  );
}

function DaysCell({ application }: CellSource) {
  return (
    <span className="flex items-center justify-end gap-2.5 text-ink-2 tabular-nums">
      <SilenceIndicator application={application} />
      {COPY.days(application.daysInStage)}
    </span>
  );
}

export const TABLE_CELLS: Record<DataColumnId, (source: CellSource) => ReactNode> = {
  vacancy: VacancyCell,
  stage: StageCell,
  score: ({ application }) => <ScoreBadge application={application} />,
  salary: ({ application }) => (
    <span className="block truncate text-ink-2 tabular-nums">
      {formatSalaryRange(application) ?? COPY.noValue}
    </span>
  ),
  source: ({ application }) => (
    <span className={cn(TRUNCATE, 'text-ink-2')}>{SOURCE_LABELS[application.source].labelUk}</span>
  ),
  appliedAt: ({ application, timeZone }) => (
    <DayCell iso={application.appliedAt} timeZone={timeZone} />
  ),
  lastEventAt: ({ application, timeZone }) => (
    <DayCell iso={application.lastEventAt} timeZone={timeZone} />
  ),
  daysInStage: DaysCell,
};
