import type { RejectionReasonCode, Stage } from '@jobflow/shared';

import type { ResponseHistory } from '../modules/contacts/index.js';
import { minutesAfter, NOW } from './time.js';

export type StageMove = ResponseHistory['stageEvents'][number];

export type Move = {
  from: Stage;
  to: Stage;
  hours: number;
  reasonCode?: RejectionReasonCode | null;
};

export const hoursLater = (hours: number) => minutesAfter(hours * 60);

export const APPLIED_AT_NOW: StageMove = {
  fromStage: null,
  toStage: 'applied',
  reasonCode: null,
  occurredAt: NOW,
};

export const moved = ({ from, to, hours, reasonCode }: Move): StageMove => ({
  fromStage: from,
  toStage: to,
  reasonCode: reasonCode ?? null,
  occurredAt: hoursLater(hours),
});

export function responseHistory(
  stageEvents: StageMove[],
  waitHours: number[] = [],
): ResponseHistory {
  return { stageEvents, waitStarts: waitHours.map((hours) => hoursLater(hours)) };
}
