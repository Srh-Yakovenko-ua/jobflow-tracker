import { IMPORT_LIMITS, parseCsv } from '@jobflow/shared';

export type ImportSheet = Readonly<{
  fileName: string;
  header: readonly string[];
  rows: readonly (readonly string[])[];
}>;

export type ImportFileRefusal = 'type' | 'size' | 'empty' | 'rows' | 'unreadable';

export type ImportFileResult =
  | Readonly<{ kind: 'sheet'; sheet: ImportSheet }>
  | Readonly<{ kind: 'refused'; reason: ImportFileRefusal }>;

const CSV_NAME = /\.csv$/i;

function refused(reason: ImportFileRefusal): ImportFileResult {
  return { kind: 'refused', reason };
}

async function textOf(file: File): Promise<string | null> {
  try {
    return await file.text();
  } catch {
    return null;
  }
}

export async function readImportFile(file: File): Promise<ImportFileResult> {
  if (!CSV_NAME.test(file.name)) return refused('type');
  if (file.size > IMPORT_LIMITS.fileMaxBytes) return refused('size');
  const text = await textOf(file);
  if (text === null) return refused('unreadable');
  const [header, ...rows] = parseCsv(text);
  if (header === undefined || rows.length === 0) return refused('empty');
  if (rows.length > IMPORT_LIMITS.rowsMax) return refused('rows');
  return { kind: 'sheet', sheet: { fileName: file.name, header, rows } };
}
