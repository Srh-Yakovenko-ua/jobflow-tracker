import { isReplyStage, REJECTION_REASONS, rejectionReasonCodeSchema } from '@jobflow/shared';

import type { ApplicationHistory } from './contacts.repository.js';

export type ResponseHistory = Pick<ApplicationHistory, 'stageEvents' | 'timelineEvents'>;

type StageMove = ResponseHistory['stageEvents'][number];

type Step = { at: Date; isReply: boolean; startsWait: boolean };

const MIN_RESPONSE_SAMPLES = 2;

const HOUR_MS = 60 * 60 * 1000;

function isCandidateSide(reasonCode: string | null): boolean {
  const code = rejectionReasonCodeSchema.safeParse(reasonCode);
  return code.success && REJECTION_REASONS[code.data].side === 'candidate';
}

function stageStep({ fromStage, toStage, reasonCode, occurredAt }: StageMove): Step {
  return {
    at: occurredAt,
    isReply: fromStage !== null && isReplyStage(toStage) && !isCandidateSide(reasonCode),
    startsWait: toStage !== 'ghosted',
  };
}

function stepsOf({ stageEvents, timelineEvents }: ResponseHistory): Step[] {
  return [
    ...stageEvents.map(stageStep),
    ...timelineEvents.map(({ occurredAt }) => ({
      at: occurredAt,
      isReply: false,
      startsWait: true,
    })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());
}

function responseHoursOf(history: ResponseHistory): number[] {
  const hours: number[] = [];
  let waitingSince: Date | null = null;
  for (const { at, isReply, startsWait } of stepsOf(history)) {
    if (isReply && waitingSince !== null) {
      hours.push((at.getTime() - waitingSince.getTime()) / HOUR_MS);
    }
    if (startsWait) {
      waitingSince = at;
    }
  }
  return hours;
}

export function averageResponseHours(histories: readonly ResponseHistory[]): number | null {
  const hours = histories.flatMap(responseHoursOf);
  if (hours.length < MIN_RESPONSE_SAMPLES) {
    return null;
  }
  return Math.round(hours.reduce((sum, value) => sum + value, 0) / hours.length);
}
