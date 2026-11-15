import {
  type InsightsResponse,
  INTERVIEW_PREP_LIMITS,
  type InterviewPrepInput,
  type InterviewPrepVacancy,
  type InterviewPrepWeakSpots,
  type ReasonsResponse,
  REJECTION_REASONS,
  WEAK_TOPIC_PATTERN,
} from '@jobflow/shared';

export type WeakSpotsSource = { reasons: ReasonsResponse; insights: InsightsResponse };

export type InterviewPrepSource = {
  vacancy: InterviewPrepVacancy;
  weakSpots: WeakSpotsSource | null;
};

const NO_WEAK_SPOTS: InterviewPrepWeakSpots = { reasons: [], topics: [] };

const reasonsOf = ({ stages }: ReasonsResponse): InterviewPrepWeakSpots['reasons'] =>
  stages
    .flatMap(({ stage, reasons }) =>
      reasons
        .filter(({ code, count }) => REJECTION_REASONS[code].side === 'company' && count > 0)
        .map(({ code, count }) => ({ stage, code, count })),
    )
    .sort((left, right) => right.count - left.count)
    .slice(0, INTERVIEW_PREP_LIMITS.reasonsMax);

function topicsOf({ insights }: InsightsResponse): string[] {
  const topics = insights.flatMap(({ evidence }) => {
    const { topic } = evidence;
    return typeof topic === 'string' && WEAK_TOPIC_PATTERN.test(topic) ? [topic] : [];
  });
  return [...new Set(topics)].slice(0, INTERVIEW_PREP_LIMITS.weakTopicsMax);
}

export function interviewPrepPayload({
  vacancy,
  weakSpots,
}: InterviewPrepSource): InterviewPrepInput {
  return {
    ...vacancy,
    weakSpots:
      weakSpots === null
        ? NO_WEAK_SPOTS
        : { reasons: reasonsOf(weakSpots.reasons), topics: topicsOf(weakSpots.insights) },
  };
}
