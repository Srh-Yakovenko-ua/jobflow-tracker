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

export function unguardedCellOf(cell: string): string {
  return cell.startsWith("'") && CSV.formulaStart.test(cell.slice(1)) ? cell.slice(1) : cell;
}

function cellOf(cell: CsvCell): string {
  return typeof cell === 'number' ? String(cell) : textCellOf(cell);
}

export function toCsv({ header, rows }: CsvTable): string {
  const lines = [header, ...rows].map((cells) => cells.map(cellOf).join(CSV.delimiter));
  return CSV.byteOrderMark + lines.map((line) => `${line}${CSV.lineEnd}`).join('');
}

const READ_DELIMITERS = [',', ';', '\t'] as const;

type CsvReader = {
  text: string;
  delimiter: string;
  rows: string[][];
  row: string[];
  cell: string;
  quoted: boolean;
};

const isLineEnd = (char: string) => char === '\n' || char === '\r';

function headerCountsOf(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && isLineEnd(char)) break;
    else if (!quoted) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  return counts;
}

function delimiterOf(text: string): string {
  const counts = headerCountsOf(text);
  const countOf = (delimiter: string) => counts.get(delimiter) ?? 0;
  return READ_DELIMITERS.reduce((best, delimiter) =>
    countOf(delimiter) > countOf(best) ? delimiter : best,
  );
}

function endCell(reader: CsvReader): void {
  reader.row.push(reader.cell);
  reader.cell = '';
}

function endRow(reader: CsvReader): void {
  endCell(reader);
  const isBlankLine = reader.row.length === 1 && reader.row[0] === '';
  if (!isBlankLine) reader.rows.push(reader.row);
  reader.row = [];
}

function quotedStep(reader: CsvReader, index: number): number {
  const char = reader.text.charAt(index);
  if (char !== '"') {
    reader.cell += char;
    return 1;
  }
  if (reader.text.charAt(index + 1) === '"') {
    reader.cell += '"';
    return 2;
  }
  reader.quoted = false;
  return 1;
}

function plainStep(reader: CsvReader, index: number): number {
  const char = reader.text.charAt(index);
  if (char === '"') {
    reader.quoted = true;
  } else if (char === reader.delimiter) {
    endCell(reader);
  } else if (isLineEnd(char)) {
    endRow(reader);
    return char === '\r' && reader.text.charAt(index + 1) === '\n' ? 2 : 1;
  } else {
    reader.cell += char;
  }
  return 1;
}

export function parseCsv(text: string): string[][] {
  const body = text.startsWith(CSV.byteOrderMark) ? text.slice(CSV.byteOrderMark.length) : text;
  const reader: CsvReader = {
    text: body,
    delimiter: delimiterOf(body),
    rows: [],
    row: [],
    cell: '',
    quoted: false,
  };
  for (let index = 0; index < body.length;) {
    index += reader.quoted ? quotedStep(reader, index) : plainStep(reader, index);
  }
  if (reader.cell !== '' || reader.row.length > 0) endRow(reader);
  return reader.rows;
}
