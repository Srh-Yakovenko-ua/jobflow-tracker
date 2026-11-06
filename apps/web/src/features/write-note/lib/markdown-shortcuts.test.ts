import { describe, expect, it } from 'vitest';

import { type KeyPress, markdownShortcutOf, type TextSelection } from './markdown-shortcuts';

type ShortcutCase = { name: string; field: string; press: KeyPress; next: string | null };

const KEY = { mod: false, shift: false, alt: false } as const;

const ENTER: KeyPress = { ...KEY, key: 'Enter', code: 'Enter' };

const BOLD: KeyPress = { ...KEY, key: 'b', code: 'KeyB', mod: true };

function fieldOf(marked: string): TextSelection {
  const caret = marked.indexOf('|');
  if (caret !== -1) {
    return { value: marked.replace('|', ''), selectionStart: caret, selectionEnd: caret };
  }
  const value = marked.replace('[', '').replace(']', '');
  return { value, selectionStart: marked.indexOf('['), selectionEnd: marked.indexOf(']') - 1 };
}

function markedOf(field: TextSelection | null): string | null {
  if (field === null) return null;
  const { value, selectionStart: start, selectionEnd: end } = field;
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`;
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`;
}

const CASES: readonly ShortcutCase[] = [
  {
    name: 'Ctrl+B wraps the selection in ** and keeps it selected',
    field: 'Треба [повторити DP]',
    press: BOLD,
    next: 'Треба **[повторити DP]**',
  },
  {
    name: 'Ctrl+B with no selection leaves the caret inside an empty pair',
    field: 'Треба |',
    press: BOLD,
    next: 'Треба **|**',
  },
  {
    name: 'Ctrl+B on the Ukrainian layout is read by its physical key',
    field: '[DP]',
    press: { ...BOLD, key: 'и' },
    next: '**[DP]**',
  },
  {
    name: 'a plain b is typed as a letter',
    field: 'D|',
    press: { ...BOLD, mod: false },
    next: null,
  },
  {
    name: 'Ctrl+Shift+B is left alone',
    field: '[DP]',
    press: { ...BOLD, shift: true },
    next: null,
  },
  {
    name: 'Enter on a dash item continues the list',
    field: '- DP|',
    press: ENTER,
    next: '- DP\n- |',
  },
  {
    name: 'Enter on a star item continues the list',
    field: '* DP|',
    press: ENTER,
    next: '* DP\n* |',
  },
  {
    name: 'Enter on a numbered item adds the next number',
    field: '1. DP|',
    press: ENTER,
    next: '1. DP\n2. |',
  },
  {
    name: 'Enter on item 9 adds item 10',
    field: '9. графи|',
    press: ENTER,
    next: '9. графи\n10. |',
  },
  {
    name: 'Enter on an indented item keeps the indent',
    field: '  - DP|',
    press: ENTER,
    next: '  - DP\n  - |',
  },
  {
    name: 'Enter inside an item splits it into two items',
    field: '- DP| і графи',
    press: ENTER,
    next: '- DP\n- | і графи',
  },
  {
    name: 'Enter on the last line of a list under a heading line continues it',
    field: 'Задачі:\n- DP\n- графи|',
    press: ENTER,
    next: 'Задачі:\n- DP\n- графи\n- |',
  },
  {
    name: 'Enter on an item followed by more text continues before that text',
    field: '- DP|\nстек без легасі',
    press: ENTER,
    next: '- DP\n- |\nстек без легасі',
  },
  {
    name: 'Enter on an empty dash item removes its marker',
    field: '- DP\n- |',
    press: ENTER,
    next: '- DP\n|',
  },
  {
    name: 'Enter on an empty numbered item removes its marker',
    field: '1. DP\n2. |',
    press: ENTER,
    next: '1. DP\n|',
  },
  {
    name: 'Enter on plain text is a plain newline',
    field: 'Команда норм|',
    press: ENTER,
    next: null,
  },
  { name: 'a dash with no space is not a list', field: '-DP|', press: ENTER, next: null },
  {
    name: 'Shift+Enter in a list is a plain newline',
    field: '- DP|',
    press: { ...ENTER, shift: true },
    next: null,
  },
  { name: 'Enter over a selection is left alone', field: '- [DP]', press: ENTER, next: null },
  {
    name: 'Enter with the caret inside the marker is left alone',
    field: '-| DP',
    press: ENTER,
    next: null,
  },
];

describe('markdownShortcutOf', () => {
  it.each(CASES)('$name', ({ field, press, next }) => {
    expect(markedOf(markdownShortcutOf({ field: fieldOf(field), press }))).toBe(next);
  });
});
