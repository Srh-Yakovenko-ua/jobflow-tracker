import { describe, expect, it } from 'vitest';

import { demoCvPdf } from './demo-cv.js';

const pdfText = () =>
  new TextDecoder().decode(demoCvPdf({ number: 2, title: 'Frontend Developer' }));

describe('the demo CV file', () => {
  it('is a one-page PDF 1.7 that ends with the end-of-file marker and names its version', () => {
    const text = pdfText();

    expect(text.startsWith('%PDF-1.7\n')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    expect(text).toContain('/Count 1');
    expect(text).toContain('(Demo candidate, Frontend Developer, CV v2) Tj');
  });

  it('points every cross-reference entry at its object and startxref at the table', () => {
    const text = pdfText();
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map(([, offset]) => Number(offset));
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);

    expect(
      offsets.map((offset, index) => text.slice(offset).startsWith(`${String(index + 1)} 0 obj\n`)),
    ).toEqual([true, true, true, true, true]);
    expect(text.slice(startxref, startxref + 9)).toBe('xref\n0 6\n');
  });
});
