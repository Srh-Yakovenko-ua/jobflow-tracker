import type { MatchBreakdown } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type MatchRow = Readonly<{ id: string; name: string; mark: string; ignored: boolean }>;

export type MatchRows = Readonly<{ matched: MatchRow[]; missing: MatchRow[] }>;

const COPY = uk.applicationPage.match;

function ignoredRow({ name }: MatchBreakdown['ignored'][number]): MatchRow {
  return { id: `ignored:${name}`, name, mark: COPY.ignored, ignored: true };
}

export function matchRowsOf({ matched, missing, ignored }: MatchBreakdown): MatchRows {
  const covered = ignored.filter(({ coverage }) => coverage !== 'missing');
  const uncovered = ignored.filter(({ coverage }) => coverage === 'missing');
  return {
    matched: [
      ...matched.map(({ name, coverage }) => ({
        id: `matched:${name}`,
        name,
        mark: COPY.coverage[coverage],
        ignored: false,
      })),
      ...covered.map(ignoredRow),
    ],
    missing: [
      ...missing.map(({ name, pointsLost }) => ({
        id: `missing:${name}`,
        name,
        mark: COPY.pointsLost(pointsLost),
        ignored: false,
      })),
      ...uncovered.map(ignoredRow),
    ],
  };
}
