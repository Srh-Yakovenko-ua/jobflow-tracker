import type { ApplicationResponse } from '@jobflow/shared';

export type EvidenceSource = Readonly<{
  rawText: ApplicationResponse['rawText'];
  evidence: string | null;
}>;

const PATTERN_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

function literal(word: string): string {
  return word.replace(PATTERN_CHARACTERS, '\\$&');
}

export function evidenceQuoteOf({ rawText, evidence }: EvidenceSource): string | null {
  if (rawText === null || evidence === null) return null;
  const words = evidence.split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return null;
  const quote = new RegExp(words.map(literal).join('\\s+')).exec(rawText);
  return quote === null ? null : quote[0];
}
