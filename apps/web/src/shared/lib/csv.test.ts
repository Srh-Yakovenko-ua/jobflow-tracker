import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

const BOM = '\uFEFF';

describe('toCsv', () => {
  it('starts with the byte order mark, splits cells with a semicolon and ends every line with CRLF, Cyrillic kept as it is', () => {
    const text = toCsv({
      header: ['Компанія', 'Посада', 'Score'],
      rows: [
        ['Соняшник', 'Дизайнер продукту', 91],
        ['Kvit Software', 'Node.js Engineer', ''],
      ],
    });

    expect(text).toBe(
      `${BOM}Компанія;Посада;Score\r\nСоняшник;Дизайнер продукту;91\r\nKvit Software;Node.js Engineer;\r\n`,
    );
  });

  it('wraps a cell holding a semicolon, a quote, a CR or a line feed in quotes and doubles its quotes', () => {
    const text = toCsv({
      header: ['Нотатка'],
      rows: [['React; Node'], ['«Acme» "Labs"'], ['перший\nдругий'], ['a\rb'], ['звичайний']],
    });

    expect(text.slice(BOM.length).split('\r\n')).toEqual([
      'Нотатка',
      '"React; Node"',
      '"«Acme» ""Labs"""',
      '"перший\nдругий"',
      '"a\rb"',
      'звичайний',
      '',
    ]);
  });

  it.each([
    { cell: '=SUM(1)', written: "'=SUM(1)" },
    { cell: '+1', written: "'+1" },
    { cell: '-1', written: "'-1" },
    { cell: '@x', written: "'@x" },
    { cell: '\tTab', written: "'\tTab" },
    { cell: '\rx', written: `"'\rx"` },
    { cell: '=A1;B1', written: `"'=A1;B1"` },
    { cell: 'a=b', written: 'a=b' },
  ])(
    'writes the text cell $cell as $written so a spreadsheet never runs it',
    ({ cell, written }) => {
      expect(toCsv({ header: ['x'], rows: [[cell]] })).toBe(`${BOM}x\r\n${written}\r\n`);
    },
  );

  it('writes numbers raw, a negative one included', () => {
    expect(toCsv({ header: ['n'], rows: [[-1], [2500.5]] })).toBe(`${BOM}n\r\n-1\r\n2500.5\r\n`);
  });
});
