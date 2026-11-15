import { IMPORT_LIMITS } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { readImportFile } from './import-file';

const HEADER_LINE = 'Компанія;Посада;Дата відгуку';

function csvFile(text: string, name = 'tracker.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

describe('readImportFile', () => {
  it('reads the header and every row of a semicolon sheet with a BOM', async () => {
    const file = csvFile(
      `\uFEFF${HEADER_LINE}\r\nVela;Frontend;2026-10-01\r\nAcme;QA;01.10.2026\r\n`,
    );

    expect(await readImportFile(file)).toEqual({
      kind: 'sheet',
      sheet: {
        fileName: 'tracker.csv',
        header: ['Компанія', 'Посада', 'Дата відгуку'],
        rows: [
          ['Vela', 'Frontend', '2026-10-01'],
          ['Acme', 'QA', '01.10.2026'],
        ],
      },
    });
  });

  it.each([
    {
      name: 'a file that is not a .csv',
      file: csvFile('a,b\n1,2', 'tracker.xlsx'),
      reason: 'type',
    },
    {
      name: 'a header with no rows under it',
      file: csvFile(`${HEADER_LINE}\r\n`),
      reason: 'empty',
    },
    { name: 'an empty file', file: csvFile(''), reason: 'empty' },
    {
      name: 'more rows than one import takes',
      file: csvFile(
        [HEADER_LINE, ...Array.from({ length: 501 }, () => 'A;B;2026-10-01')].join('\n'),
      ),
      reason: 'rows',
    },
    {
      name: 'a file over the size limit',
      file: csvFile('x'.repeat(IMPORT_LIMITS.fileMaxBytes + 1)),
      reason: 'size',
    },
  ])('refuses $name', async ({ file, reason }) => {
    expect(await readImportFile(file)).toEqual({ kind: 'refused', reason });
  });
});
