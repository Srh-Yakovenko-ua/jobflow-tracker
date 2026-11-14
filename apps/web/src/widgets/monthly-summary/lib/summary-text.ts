import { uk } from '@/shared/i18n';
import type { AnalyticsBlock } from '@/shared/lib/analytics-anchors';

export type SummaryPart = Readonly<{ id: string; text: string; block: AnalyticsBlock | null }>;

export type SummaryParagraph = Readonly<{ id: string; parts: readonly SummaryPart[] }>;

type Piece = Readonly<{ text: string; block: AnalyticsBlock | null }>;

const NUMBER = /(?<![\p{L}\d])\d+(?:[.,]\d+)?(?:\.\d{4})?%?/gu;

const YEAR_OR_DATE = /^(?:(?:19|20)\d{2}|\d{1,2}\.\d{2}(?:\.\d{4})?)$/u;

const CHARTLESS: ReadonlySet<AnalyticsBlock> = new Set(['resumeAb']);

const CLAUSE_SEPARATOR = /((?<!\d)[,;:.!?]|[,;:.!?](?!\d))/u;

const SENTENCE_END = /[.!?]/u;

const PARAGRAPH_BREAK = /\n\s*\n/u;

const BLOCK_PRIORITY: readonly AnalyticsBlock[] = [
  'resumeAb',
  'sources',
  'reasons',
  'forecast',
  'funnel',
  'kpis',
];

function blockOf(clause: string): AnalyticsBlock | null {
  return BLOCK_PRIORITY.find((block) => uk.summary.keywords[block].test(clause)) ?? null;
}

function clausesOf(paragraph: string): Piece[] {
  const clauses: Piece[] = [];
  let sentenceBlock: AnalyticsBlock | null = null;
  for (const [index, text] of paragraph.split(CLAUSE_SEPARATOR).entries()) {
    const separator = index % 2 === 1;
    if (!separator) sentenceBlock = blockOf(text) ?? sentenceBlock;
    clauses.push({ text, block: separator ? null : sentenceBlock });
    if (separator && SENTENCE_END.test(text)) sentenceBlock = null;
  }
  return clauses;
}

function numbersOf({ text, block }: Piece): Piece[] {
  if (block === null || CHARTLESS.has(block)) return [{ text, block: null }];
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const match of text.matchAll(NUMBER)) {
    if (YEAR_OR_DATE.test(match[0])) continue;
    pieces.push({ text: text.slice(cursor, match.index), block: null }, { text: match[0], block });
    cursor = match.index + match[0].length;
  }
  pieces.push({ text: text.slice(cursor), block: null });
  return pieces;
}

function joinedPlain(pieces: readonly Piece[]): Piece[] {
  return pieces.reduce<Piece[]>((joined, piece) => {
    const last = joined.at(-1);
    if (piece.text === '') return joined;
    if (last?.block === null && piece.block === null) {
      return [...joined.slice(0, -1), { text: last.text + piece.text, block: null }];
    }
    return [...joined, piece];
  }, []);
}

function partsOf(paragraph: string): SummaryPart[] {
  let offset = 0;
  return joinedPlain(clausesOf(paragraph).flatMap(numbersOf)).map((piece) => {
    const part = { ...piece, id: `part-${String(offset)}` };
    offset += piece.text.length;
    return part;
  });
}

export function summaryParagraphsOf(text: string): SummaryParagraph[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph, index) => ({ id: `paragraph-${String(index)}`, parts: partsOf(paragraph) }));
}
