import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { type SummaryParagraph, summaryParagraphsOf } from './summary-text';

const DESIGN_TEXT = buildMonthlySummaryOutput().summary;

function linkedOf(paragraphs: readonly SummaryParagraph[]) {
  return paragraphs.flatMap((paragraph) =>
    paragraph.parts.flatMap((part) => (part.block === null ? [] : [[part.text, part.block]])),
  );
}

function textOf(paragraph: SummaryParagraph | undefined): string {
  return paragraph?.parts.map((part) => part.text).join('') ?? '';
}

describe('summaryParagraphsOf', () => {
  it('links each number of the design summary to the chart its clause talks about', () => {
    expect(linkedOf(summaryParagraphsOf(DESIGN_TEXT))).toEqual([
      ['19', 'kpis'],
      ['4', 'kpis'],
      ['9', 'funnel'],
      ['4', 'funnel'],
      ['3', 'reasons'],
      ['4', 'reasons'],
    ]);
  });

  it('keeps the plan count and the CV version as plain text, losing no character', () => {
    const [paragraph] = summaryParagraphsOf(DESIGN_TEXT);
    const plain = paragraph?.parts.filter((part) => part.block === null).map((part) => part.text);

    expect(plain?.some((text) => text.includes('ти виконав 3 пункти з 4.'))).toBe(true);
    expect(plain?.some((text) => text.includes('CV v2'))).toBe(true);
    expect(textOf(paragraph)).toBe(DESIGN_TEXT);
  });

  it('a decimal number stays one number and a sentence end drops the clause block', () => {
    const [paragraph] = summaryParagraphsOf('Прогноз 4,5 тижня. Далі 7 кроків.');

    expect(linkedOf(paragraph === undefined ? [] : [paragraph])).toEqual([['4,5', 'forecast']]);
  });

  it('серпень 2026 and the dates 01.09 and 15.09.2026 are not links, the counts beside them are', () => {
    const paragraphs = summaryParagraphsOf(
      'За серпень 2026 ти надіслав 19 відгуків. Скринінги з 01.09 по 15.09.2026 дали 4 техінтерв’ю.',
    );

    expect(linkedOf(paragraphs)).toEqual([
      ['19', 'kpis'],
      ['4', 'funnel'],
    ]);
  });

  it('a CV number stays plain text while the A/B block is hidden', () => {
    expect(linkedOf(summaryParagraphsOf('CV v2 дало 41% скринінгів, а v1 лише 24%.'))).toEqual([]);
  });

  it('splits the text into paragraphs on blank lines', () => {
    const paragraphs = summaryParagraphsOf('Перший абзац.\n\nДругий абзац.');

    expect(paragraphs.map(textOf)).toEqual(['Перший абзац.', 'Другий абзац.']);
  });
});
