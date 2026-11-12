import {
  type MatchBreakdown,
  type MatchCoverage,
  matchFailure,
  type MatchOutput,
  type MatchRequirement,
  type MatchWeight,
} from '@jobflow/shared';

export const MATCH_POINTS = { must: 3, nice: 1, mentioned: 0 } as const satisfies Record<
  MatchWeight,
  number
>;

export const COVERAGE_CREDIT = { full: 1, partial: 0.5, missing: 0 } as const satisfies Record<
  MatchCoverage,
  number
>;

type WeighedRequirement = MatchRequirement & { weight: Exclude<MatchWeight, 'mentioned'> };

type ScoredRequirement = WeighedRequirement & { pointsLost: number };

type MissingRequirement = MatchBreakdown['missing'][number];

const isWeighed = (requirement: MatchRequirement): requirement is WeighedRequirement =>
  requirement.weight !== 'mentioned';

const byLossThenName = (left: MissingRequirement, right: MissingRequirement) =>
  right.pointsLost - left.pointsLost || left.name.localeCompare(right.name, 'en');

function scored(requirements: WeighedRequirement[]): ScoredRequirement[] {
  const total = requirements.reduce((sum, { weight }) => sum + MATCH_POINTS[weight], 0);
  return requirements.map((requirement) => {
    const uncovered =
      MATCH_POINTS[requirement.weight] * (1 - COVERAGE_CREDIT[requirement.coverage]);
    return { ...requirement, pointsLost: Math.round((100 * uncovered) / total) };
  });
}

function matchedOf(requirements: ScoredRequirement[]): MatchBreakdown['matched'] {
  return requirements.flatMap(({ coverage, ...requirement }) =>
    coverage === 'missing' ? [] : [{ ...requirement, coverage }],
  );
}

function missingOf(requirements: ScoredRequirement[]): MissingRequirement[] {
  return requirements
    .filter(({ coverage }) => coverage === 'missing')
    .map(({ name, weight, pointsLost }) => ({ name, weight, pointsLost }))
    .sort(byLossThenName);
}

export function scoreMatch(output: MatchOutput): MatchBreakdown | null {
  if (matchFailure(output) !== null) {
    return null;
  }
  const requirements = scored(output.requirements.filter(isWeighed));
  const lost = requirements.reduce((sum, { pointsLost }) => sum + pointsLost, 0);
  return {
    score: Math.max(0, 100 - lost),
    matched: matchedOf(requirements),
    missing: missingOf(requirements),
    ignored: output.requirements
      .filter((requirement) => !isWeighed(requirement))
      .map(({ name, coverage }) => ({ name, coverage })),
    explanation: output.explanation,
  };
}
