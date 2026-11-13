import {
  FOLLOWUP_LIMITS,
  type FollowupInput,
  type Stage,
  userNow,
  wholeDaysBetween,
} from '@jobflow/shared';
import { format } from 'date-fns';

type InterviewKind = NonNullable<FollowupInput['lastInterview']>['kind'];

export type FollowupSource = {
  application: { company: string; position: string; currentStage: Stage; lastEventAt: Date };
  recruiterName: string | null;
  lastInterview: { kind: InterviewKind; startsAt: Date } | null;
  senderName: string | null;
  timezone: string;
  request: Pick<FollowupInput, 'tone' | 'language'> & { hint?: string };
  now: Date;
};

const SENDER_NAME_MAX_LENGTH = 100;

const filledOrNull = (text: string, maxLength: number) => text.slice(0, maxLength) || null;

const firstNameOf = (name: string | null) =>
  filledOrNull(name?.trim().split(/\s+/)[0] ?? '', FOLLOWUP_LIMITS.recruiterNameMaxLength);

export function followupPayload(source: FollowupSource): FollowupInput {
  const { application, lastInterview, timezone, request, now } = source;
  return {
    recruiterFirstName: firstNameOf(source.recruiterName),
    company: application.company,
    position: application.position,
    stage: application.currentStage,
    silenceDays: wholeDaysBetween(application.lastEventAt, now),
    lastInterview:
      lastInterview === null
        ? null
        : {
            kind: lastInterview.kind,
            date: format(userNow({ timezone }, lastInterview.startsAt), 'yyyy-MM-dd'),
          },
    senderName: filledOrNull(source.senderName?.trim() ?? '', SENDER_NAME_MAX_LENGTH),
    language: request.language,
    tone: request.tone,
    hint: request.hint ?? null,
  };
}
