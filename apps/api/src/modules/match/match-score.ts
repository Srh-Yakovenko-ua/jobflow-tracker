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

const earnedOf = ({ weight, coverage }: WeighedRequirement) =>
  MATCH_POINTS[weight] * COVERAGE_CREDIT[coverage];

function scored(requirements: WeighedRequirement[], total: number): ScoredRequirement[] {
  return requirements.map((requirement) => {
    const uncovered = MATCH_POINTS[requirement.weight] - earnedOf(requirement);
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
  const weighed = output.requirements.filter(isWeighed);
  const total = weighed.reduce((sum, { weight }) => sum + MATCH_POINTS[weight], 0);
  const earned = weighed.reduce((sum, requirement) => sum + earnedOf(requirement), 0);
  const requirements = scored(weighed, total);
  return {
    score: Math.round((100 * earned) / total),
    matched: matchedOf(requirements),
    missing: missingOf(requirements),
    ignored: output.requirements
      .filter((requirement) => !isWeighed(requirement))
      .map(({ name, coverage }) => ({ name, coverage })),
    explanation: output.explanation,
  };
}
