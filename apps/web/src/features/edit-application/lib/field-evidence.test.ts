import { describe, expect, it } from 'vitest';

import { evidenceQuoteOf } from './field-evidence';

const RAW_TEXT = [
  'Kvit Software шукає Senior',
  '  Node.js   Engineer.',
  'Вилка: від 4700',
  'до  5900 net. Бонус $4000+ на старті.',
  'Стек: C++ (.NET), Kafka',
].join('\n');

describe('evidenceQuoteOf', () => {
  it('a quote that crosses a line break and double spaces comes back as the slice of the text, character for character', () => {
    const quote = evidenceQuoteOf({ rawText: RAW_TEXT, evidence: 'від 4700 до 5900 net' });

    expect(quote).toBe('від 4700\nдо  5900 net');
    expect(RAW_TEXT).toContain(quote);
  });

  it('a quote the model padded with spaces still finds its words in the text', () => {
    expect(evidenceQuoteOf({ rawText: RAW_TEXT, evidence: '  Senior Node.js  Engineer ' })).toBe(
      'Senior\n  Node.js   Engineer',
    );
  });

  it.each(['C++ (.NET)', '$4000+'])('the quote %j is matched as written', (evidence) => {
    expect(evidenceQuoteOf({ rawText: RAW_TEXT, evidence })).toBe(evidence);
  });

  it.each(['K.fka', 'C+', '(.NET|Kafka)', '\\w+'])(
    'the quote %j is no pattern and finds nothing',
    (evidence) => {
      expect(evidenceQuoteOf({ rawText: 'Стек: Kafka, CCC', evidence })).toBeNull();
    },
  );

  it('a quote absent from the text finds nothing', () => {
    expect(evidenceQuoteOf({ rawText: RAW_TEXT, evidence: '4000-5000 USD' })).toBeNull();
  });

  it.each([
    { rawText: null, evidence: 'Kafka' },
    { rawText: RAW_TEXT, evidence: null },
    { rawText: RAW_TEXT, evidence: '   ' },
  ])('with text $rawText and evidence $evidence there is no quote', (source) => {
    expect(evidenceQuoteOf(source)).toBeNull();
  });
});
