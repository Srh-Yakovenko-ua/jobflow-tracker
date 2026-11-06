import { type ApplicationListItem, SOURCE_LABELS, STAGES } from '@jobflow/shared';
import { createColumnHelper, type SortingState } from '@tanstack/react-table';

import { uk } from '@/shared/i18n';

import type { ApplicationTableFeatures } from './table-features';

export const DATA_COLUMN_IDS = [
  'vacancy',
  'stage',
  'score',
  'salary',
  'source',
  'appliedAt',
  'lastEventAt',
  'daysInStage',
] as const;

export type DataColumnId = (typeof DATA_COLUMN_IDS)[number];

export function isDataColumnId(id: string): id is DataColumnId {
  return DATA_COLUMN_IDS.some((known) => known === id);
}

export function dataColumnIdsOf(columns: readonly Readonly<{ id: string }>[]): DataColumnId[] {
  return columns.flatMap((column) => (isDataColumnId(column.id) ? [column.id] : []));
}

export const SELECT_COLUMN_ID = 'select';

export const INITIAL_SORTING: SortingState = [{ id: 'lastEventAt', desc: true }];

const column = createColumnHelper<ApplicationTableFeatures, ApplicationListItem>();

const COMPANY_ORDER = new Intl.Collator(uk.locale, { numeric: true, sensitivity: 'base' });

const EMPTY_LAST = { sortUndefined: 'last' } as const;

function instantOf(iso: string | null): number | undefined {
  return iso === null ? undefined : Date.parse(iso);
}

function salaryKeyOf({ salaryMin, salaryMax }: ApplicationListItem): number | undefined {
  return salaryMax ?? salaryMin ?? undefined;
}

export const APPLICATION_COLUMNS = column.columns([
  column.display({ id: SELECT_COLUMN_ID, enableSorting: false, enableHiding: false }),
  column.accessor('company', {
    id: 'vacancy',
    sortFn: (left, right) => COMPANY_ORDER.compare(left.original.company, right.original.company),
  }),
  column.accessor((application) => STAGES.indexOf(application.currentStage), {
    id: 'stage',
    sortDescFirst: false,
  }),
  column.accessor((application) => application.matchScore ?? undefined, {
    id: 'score',
    ...EMPTY_LAST,
  }),
  column.accessor(salaryKeyOf, { id: 'salary', ...EMPTY_LAST }),
  column.accessor((application) => SOURCE_LABELS[application.source].labelUk, {
    id: 'source',
    sortFn: 'alphanumeric',
  }),
  column.accessor((application) => instantOf(application.appliedAt), {
    id: 'appliedAt',
    ...EMPTY_LAST,
  }),
  column.accessor((application) => Date.parse(application.lastEventAt), { id: 'lastEventAt' }),
  column.accessor('daysInStage', { id: 'daysInStage' }),
]);
