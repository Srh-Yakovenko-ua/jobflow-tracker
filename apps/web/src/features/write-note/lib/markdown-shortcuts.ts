export type TextSelection = Readonly<{
  value: string;
  selectionStart: number;
  selectionEnd: number;
}>;

export type KeyPress = Readonly<{
  key: string;
  code: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}>;

export type MarkdownShortcutInput = Readonly<{ field: TextSelection; press: KeyPress }>;

type ListLine = Readonly<{ start: number; text: string; marker: RegExpExecArray }>;

const BOLD = '**';

const LIST_MARKER = /^(\s*)(?:([-*])|(\d+)\.) /;

function isBold(press: KeyPress): boolean {
  const letter = press.key.toLowerCase() === 'b' || press.code === 'KeyB';
  return letter && press.mod && !press.shift && !press.alt;
}

function isPlainEnter(press: KeyPress): boolean {
  return press.key === 'Enter' && !press.mod && !press.shift && !press.alt;
}

function wrapBold({ value, selectionStart, selectionEnd }: TextSelection): TextSelection {
  const selected = value.slice(selectionStart, selectionEnd);
  return {
    value: `${value.slice(0, selectionStart)}${BOLD}${selected}${BOLD}${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + BOLD.length,
    selectionEnd: selectionEnd + BOLD.length,
  };
}

function listLineAt({ value, selectionStart: caret }: TextSelection): ListLine | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const end = value.indexOf('\n', caret);
  const text = value.slice(start, end === -1 ? value.length : end);
  const marker = LIST_MARKER.exec(text);
  if (marker === null || caret < start + marker[0].length) return null;
  return { start, text, marker };
}

function nextMarkerOf(marker: RegExpExecArray): string {
  const [, indent = '', bullet, number] = marker;
  return bullet === undefined ? `${indent}${String(Number(number) + 1)}. ` : `${indent}${bullet} `;
}

function insertAtCaret(field: TextSelection, text: string): TextSelection {
  const { value, selectionStart: caret } = field;
  const next = caret + text.length;
  return {
    value: `${value.slice(0, caret)}${text}${value.slice(caret)}`,
    selectionStart: next,
    selectionEnd: next,
  };
}

function breakList(field: TextSelection): TextSelection | null {
  if (field.selectionStart !== field.selectionEnd) return null;
  const line = listLineAt(field);
  if (line === null) return null;
  const markerLength = line.marker[0].length;
  if (line.text.slice(markerLength).trim() !== '') {
    return insertAtCaret(field, `\n${nextMarkerOf(line.marker)}`);
  }
  const { value } = field;
  const unmarked = `${value.slice(0, line.start)}${value.slice(line.start + markerLength)}`;
  return { value: unmarked, selectionStart: line.start, selectionEnd: line.start };
}

export function markdownShortcutOf({ field, press }: MarkdownShortcutInput): TextSelection | null {
  if (isBold(press)) return wrapBold(field);
  return isPlainEnter(press) ? breakList(field) : null;
}
