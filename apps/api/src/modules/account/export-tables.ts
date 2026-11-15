import {
  APPLICATION_CSV_HEADER,
  type CsvCell,
  type CsvTable,
  IMPORT_FIELDS,
  type ImportField,
  rejectionReasonCodeSchema,
  salaryText,
  stageHistoryText,
} from '@jobflow/shared';

import type { ExportApplicationRow, ExportData } from './account-export.repository.js';
import type { ExportTables } from './export-files.js';

const textOf = (value: string | null): string => value ?? '';

const numberOf = (value: number | null): CsvCell => value ?? '';

const historyOf = ({ stageEvents }: ExportApplicationRow) =>
  stageEvents.map(({ toStage, reasonCode, occurredAt }) => ({
    toStage,
    reasonCode: rejectionReasonCodeSchema.nullable().parse(reasonCode),
    occurredAt: occurredAt.toISOString(),
  }));

function templateCellsOf(application: ExportApplicationRow): Record<ImportField, CsvCell> {
  return {
    company: application.company,
    position: application.position,
    source: application.source,
    appliedAt: (application.appliedAt ?? application.createdAt).toISOString(),
    stage: application.currentStage,
    salary: salaryText(application),
    url: textOf(application.url),
    stageHistory: stageHistoryText(historyOf(application)),
  };
}

function applicationsTable(applications: ExportApplicationRow[]): CsvTable {
  return {
    header: [
      ...APPLICATION_CSV_HEADER,
      'id',
      'search',
      'location',
      'work_mode',
      'stack',
      'match_score',
    ],
    rows: applications.map((application) => {
      const template = templateCellsOf(application);
      return [
        ...IMPORT_FIELDS.map((field) => template[field]),
        application.id,
        application.search.title,
        textOf(application.location),
        textOf(application.workMode),
        application.stack.join(', '),
        numberOf(application.matchScore),
      ];
    }),
  };
}

const stageEventsTable = (applications: ExportApplicationRow[]): CsvTable => ({
  header: [
    'application_id',
    'from_stage',
    'to_stage',
    'reason_code',
    'reason',
    'comment',
    'occurred_at',
  ],
  rows: applications.flatMap(({ id, stageEvents }) =>
    stageEvents.map((event) => [
      id,
      textOf(event.fromStage),
      event.toStage,
      textOf(event.reasonCode),
      textOf(event.reason?.labelUk ?? null),
      textOf(event.comment),
      event.occurredAt.toISOString(),
    ]),
  ),
});

const contactsTable = (applications: ExportApplicationRow[]): CsvTable => ({
  header: ['application_id', 'name', 'role', 'email', 'telegram', 'phone', 'note'],
  rows: applications.flatMap(({ id, contacts }) =>
    contacts.map(({ name, role, email, telegram, phone, note }) => [
      id,
      name,
      ...[role, email, telegram, phone, note].map(textOf),
    ]),
  ),
});

const notesTable = (applications: ExportApplicationRow[]): CsvTable => ({
  header: ['application_id', 'body', 'created_at'],
  rows: applications.flatMap(({ id, notes }) =>
    notes.map(({ body, createdAt }) => [id, body, createdAt.toISOString()]),
  ),
});

const resumeVersionsTable = ({ resumeVersions }: ExportData): CsvTable => ({
  header: [
    'id',
    'resume_id',
    'number',
    'title',
    'filename',
    'mime',
    'size_bytes',
    'note',
    'is_archived',
    'uploaded_at',
  ],
  rows: resumeVersions.map((version) => [
    version.id,
    version.resumeId,
    version.number,
    version.title,
    version.filename,
    version.mime,
    version.sizeBytes,
    textOf(version.note),
    String(version.isArchived),
    version.uploadedAt.toISOString(),
  ]),
});

export function exportTablesOf(data: ExportData): ExportTables {
  const { applications } = data;
  return {
    applications: applicationsTable(applications),
    stage_events: stageEventsTable(applications),
    contacts: contactsTable(applications),
    notes: notesTable(applications),
    resume_versions: resumeVersionsTable(data),
  };
}
