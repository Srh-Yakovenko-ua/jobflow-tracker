export type CsvCell = string | number;

export type CsvTable = Readonly<{
  header: readonly string[];
  rows: readonly (readonly CsvCell[])[];
}>;

export const CSV_FILE_TYPE = 'text/csv;charset=utf-8';

const CSV = {
  byteOrderMark: '\uFEFF',
  delimiter: ';',
  lineEnd: '\r\n',
  quoted: /[;"\r\n]/,
  formulaStart: /^[=+\-@\t\r]/,
} as const;

function textCellOf(text: string): string {
  const inert = CSV.formulaStart.test(text) ? `'${text}` : text;
  return CSV.quoted.test(inert) ? `"${inert.replaceAll('"', '""')}"` : inert;
}

function cellOf(cell: CsvCell): string {
  return typeof cell === 'number' ? String(cell) : textCellOf(cell);
}

export function toCsv({ header, rows }: CsvTable): string {
  const lines = [header, ...rows].map((cells) => cells.map(cellOf).join(CSV.delimiter));
  return CSV.byteOrderMark + lines.map((line) => `${line}${CSV.lineEnd}`).join('');
}
