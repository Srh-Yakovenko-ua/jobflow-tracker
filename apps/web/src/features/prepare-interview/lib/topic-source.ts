import {
  type InterviewPrepTopic,
  NOTE_TOPIC_LABELS,
  noteTopicSchema,
  REJECTION_REASONS,
  rejectionReasonCodeSchema,
} from '@jobflow/shared';

export type TopicSource = Readonly<{ kind: 'weakSpot' | 'requirement'; detail: string }>;

function weakSpotLabelOf(basis: string): string | undefined {
  const reason = rejectionReasonCodeSchema.safeParse(basis);
  if (reason.success) return REJECTION_REASONS[reason.data].labelUk;
  const topic = noteTopicSchema.safeParse(basis);
  return topic.success ? NOTE_TOPIC_LABELS[topic.data].labelUk : undefined;
}

export function topicSourceOf(basis: InterviewPrepTopic['basis']): TopicSource {
  const weakSpot = weakSpotLabelOf(basis);
  return weakSpot === undefined
    ? { kind: 'requirement', detail: basis }
    : { kind: 'weakSpot', detail: weakSpot };
}
