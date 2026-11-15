import { type CsvTable, type ExportFormat, toCsv } from '@jobflow/shared';
import { strToU8, zipSync } from 'fflate';

export const EXPORT_MIME = 'application/zip';

export const EXPORT_FILES = [
  'applications',
  'stage_events',
  'contacts',
  'notes',
  'resume_versions',
] as const;

export type ExportFile = (typeof EXPORT_FILES)[number];

export type ExportTables = Record<ExportFile, CsvTable>;

export type ExportRef = { userId: string; exportId: string };

export type ExportArchive = { tables: ExportTables; format: ExportFormat };

export const userObjectsPrefix = (userId: string) => `users/${userId}/`;

export const exportsPrefix = (userId: string) => `${userObjectsPrefix(userId)}exports/`;

export const exportKey = ({ userId, exportId }: ExportRef) =>
  `${exportsPrefix(userId)}${exportId}.zip`;

export const exportFilename = (at: Date) => `jobflow-export-${at.toISOString().slice(0, 10)}.zip`;

const jsonOf = ({ header, rows }: CsvTable) =>
  JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(header.map((column, index) => [column, row[index] ?? ''])),
    ),
    null,
    2,
  );

const WRITERS: Record<ExportFormat, (table: CsvTable) => string> = { csv: toCsv, json: jsonOf };

export function exportZipOf({ tables, format }: ExportArchive): Uint8Array {
  const files = Object.fromEntries(
    EXPORT_FILES.map((file): [string, Uint8Array] => [
      `${file}.${format}`,
      strToU8(WRITERS[format](tables[file])),
    ]),
  );
  return zipSync(files);
}
