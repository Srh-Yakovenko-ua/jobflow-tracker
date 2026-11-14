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
      ['24%', 'resumeAb'],
      ['41%', 'resumeAb'],
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

  it('splits the text into paragraphs on blank lines', () => {
    const paragraphs = summaryParagraphsOf('Перший абзац.\n\nДругий абзац.');

    expect(paragraphs.map(textOf)).toEqual(['Перший абзац.', 'Другий абзац.']);
  });
});
