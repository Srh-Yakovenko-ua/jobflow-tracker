import { type ApplicationListItem, SOURCE_LABELS, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { CSV_FILE_TYPE, type CsvCell, type CsvTable, toCsv } from '@/shared/lib/csv';
import type { TextFile } from '@/shared/lib/save-text-file';
import { dayKeyOf } from '@/shared/lib/zoned-time';

import type { DataColumnId } from '../model/columns';

export type TableCsvSource = Readonly<{
  applications: readonly ApplicationListItem[];
  columns: readonly DataColumnId[];
  timeZone: string;
}>;

export type TableCsvFileSource = TableCsvSource & Readonly<{ now: Date }>;

type CellSource = Readonly<{ application: ApplicationListItem; timeZone: string }>;

type CsvColumn = Readonly<{
  header: readonly string[];
  cells: (source: CellSource) => readonly CsvCell[];
}>;

const HEADER = uk.applicationsTable.csv.header;

const COLUMN = uk.applicationsTable.columns;

function blankOf(value: CsvCell | null): CsvCell {
  return value ?? '';
}

function dayOf({ iso, timeZone }: Readonly<{ iso: string | null; timeZone: string }>): string {
  return iso === null ? '' : dayKeyOf(new Date(iso), timeZone);
}

const CSV_COLUMNS: Record<DataColumnId, CsvColumn> = {
  vacancy: {
    header: [HEADER.company, HEADER.position],
    cells: ({ application }) => [application.company, application.position],
  },
  stage: {
    header: [COLUMN.stage.menu],
    cells: ({ application }) => [STAGE_LABELS[application.currentStage].labelUk],
  },
  score: {
    header: [COLUMN.score.menu],
    cells: ({ application }) => [blankOf(application.matchScore)],
  },
  salary: {
    header: [HEADER.salaryFrom, HEADER.salaryTo, HEADER.currency],
    cells: ({ application }) => [
      blankOf(application.salaryMin),
      blankOf(application.salaryMax),
      blankOf(application.currency),
    ],
  },
  source: {
    header: [COLUMN.source.menu],
    cells: ({ application }) => [SOURCE_LABELS[application.source].labelUk],
  },
  appliedAt: {
    header: [COLUMN.appliedAt.menu],
    cells: ({ application, timeZone }) => [dayOf({ iso: application.appliedAt, timeZone })],
  },
  lastEventAt: {
    header: [COLUMN.lastEventAt.menu],
    cells: ({ application, timeZone }) => [dayOf({ iso: application.lastEventAt, timeZone })],
  },
  daysInStage: {
    header: [COLUMN.daysInStage.menu],
    cells: ({ application }) => [application.daysInStage],
  },
};

export function tableCsvOf({ applications, columns, timeZone }: TableCsvSource): CsvTable {
  const shown = columns.map((id) => CSV_COLUMNS[id]);
  return {
    header: shown.flatMap((column) => column.header),
    rows: applications.map((application) =>
      shown.flatMap((column) => column.cells({ application, timeZone })),
    ),
  };
}

export function tableCsvFileOf({ now, ...source }: TableCsvFileSource): TextFile {
  return {
    text: toCsv(tableCsvOf(source)),
    fileName: `jobflow-applications-${dayKeyOf(now, source.timeZone)}.csv`,
    type: CSV_FILE_TYPE,
  };
}
