import { describe, expect, it } from 'vitest';

import { parseCsv, toCsv, unguardedCellOf } from './csv.js';

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

describe('parseCsv', () => {
  it('reads a comma file with a quoted cell holding a comma and a doubled quote', () => {
    expect(parseCsv('company,position\n"Acme, Inc","Senior ""Node"" dev"\nKvit,QA\n')).toEqual([
      ['company', 'position'],
      ['Acme, Inc', 'Senior "Node" dev'],
      ['Kvit', 'QA'],
    ]);
  });

  it('reads a semicolon file with CRLF line ends and a comma left inside a plain cell', () => {
    expect(parseCsv('Компанія;Посада\r\nСоняшник;Дизайнер, продукт\r\n')).toEqual([
      ['Компанія', 'Посада'],
      ['Соняшник', 'Дизайнер, продукт'],
    ]);
  });

  it('reads a tab file whose last line has no line end', () => {
    expect(parseCsv('company\tposition\nAcme\tQA')).toEqual([
      ['company', 'position'],
      ['Acme', 'QA'],
    ]);
  });

  it('picks the delimiter from the header outside quotes', () => {
    expect(parseCsv('"a;b",c\n1,2\n')).toEqual([
      ['a;b', 'c'],
      ['1', '2'],
    ]);
  });

  it('keeps a line feed inside a quoted cell and an empty cell, and skips blank lines', () => {
    expect(parseCsv('a;b\n\n"перший\nдругий";\n')).toEqual([
      ['a', 'b'],
      ['перший\nдругий', ''],
    ]);
  });

  it('reads back what toCsv wrote, the byte order mark stripped', () => {
    const table = {
      header: ['Компанія', 'Нотатка', 'n'],
      rows: [
        ['Acme; Labs', '«Acme» "Labs"', 91],
        ['Kvit', 'перший\r\nдругий', -1],
      ],
    };

    expect(parseCsv(toCsv(table))).toEqual([
      ['Компанія', 'Нотатка', 'n'],
      ['Acme; Labs', '«Acme» "Labs"', '91'],
      ['Kvit', 'перший\r\nдругий', '-1'],
    ]);
  });
});

describe('unguardedCellOf', () => {
  it.each([
    { cell: "'=SUM(1)", read: '=SUM(1)' },
    { cell: "'-1", read: '-1' },
    { cell: "'\tTab", read: '\tTab' },
    { cell: "'quoted'", read: "'quoted'" },
    { cell: "O'Neil", read: "O'Neil" },
  ])('reads $cell back as $read', ({ cell, read }) => {
    expect(unguardedCellOf(cell)).toBe(read);
  });
});
