import {
  byPointsLostThenName,
  type CvHintsInput,
  cvHintsProfileSchema,
  type CvHintsRequirement,
  type MatchBreakdown,
} from '@jobflow/shared';

export type CvHintsSource = { position: string; profile: unknown; breakdown: MatchBreakdown };

function requirementsOf({ matched, missing }: MatchBreakdown): CvHintsRequirement[] {
  const missingRows = missing.map((row) => ({ ...row, coverage: 'missing' as const }));
  return [...matched, ...missingRows]
    .map(({ name, weight, coverage, pointsLost }) => ({ name, weight, coverage, pointsLost }))
    .sort(byPointsLostThenName);
}

export function cvHintsPayload({ position, profile, breakdown }: CvHintsSource): CvHintsInput {
  return {
    position,
    score: breakdown.score,
    requirements: requirementsOf(breakdown),
    profile: cvHintsProfileSchema.parse(profile),
  };
}
