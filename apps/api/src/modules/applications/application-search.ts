import type { SearchSnippet } from '@jobflow/shared';

export type SearchMatch = { id: string; rank: number };

export type RankedPageInput = {
  matches: readonly SearchMatch[];
  allowedIds: readonly string[];
  cursor?: SearchMatch | undefined;
  take: number;
};

export const HEADLINE_MARKS = { start: '', stop: '' } as const;

function markedPartsOf(piece: string): SearchSnippet {
  const [matched = '', ...rest] = piece.split(HEADLINE_MARKS.stop);
  return [
    { text: matched, match: true },
    { text: rest.join(''), match: false },
  ];
}

export function snippetPartsOf(headline: string): SearchSnippet | null {
  const [lead = '', ...marked] = headline.split(HEADLINE_MARKS.start);
  const parts = [{ text: lead, match: false }, ...marked.flatMap(markedPartsOf)].filter(
    ({ text }) => text !== '',
  );
  return parts.some(({ match }) => match) ? parts : null;
}

export function inRankOrder<Row extends { id: string }>(
  rows: readonly Row[],
  ranked: readonly SearchMatch[],
): Row[] {
  const rowOf = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ id }) => rowOf.get(id) ?? []);
}

function isAfter(match: SearchMatch, cursor: SearchMatch): boolean {
  return match.rank < cursor.rank || (match.rank === cursor.rank && match.id < cursor.id);
}

export function rankedPage({ matches, allowedIds, cursor, take }: RankedPageInput): SearchMatch[] {
  const allowed = new Set(allowedIds);
  return matches
    .filter((match) => allowed.has(match.id) && (cursor === undefined || isAfter(match, cursor)))
    .slice(0, take);
}
