import { type ApplicationResponse, effectiveSilenceDays, isActiveStage } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';

export type WaitingRow = { title: string; meta: string };

export type WaitingRowInput = {
  application: ApplicationResponse;
  silenceDays: number;
  timeZone: string;
};

const COPY = uk.timeline;

function daysAfter(at: string, days: number): Date {
  const later = new Date(at);
  later.setUTCDate(later.getUTCDate() + days);
  return later;
}

export function waitingRowOf({
  application,
  silenceDays,
  timeZone,
}: WaitingRowInput): WaitingRow | null {
  const { currentStage, isDraft, daysSinceLastEvent: days, lastEventAt } = application;
  if (!isActiveStage(currentStage) || isDraft) {
    return null;
  }
  const threshold = effectiveSilenceDays({ silenceDays }, currentStage);
  const title = COPY.waiting(COPY.stageGenitive[currentStage]);
  if (days >= threshold) {
    return { title, meta: COPY.silencePassed({ days, threshold }) };
  }
  const remindOn = formatDayMonth({ at: daysAfter(lastEventAt, threshold), timeZone });
  return { title, meta: COPY.silence({ days, threshold, remindOn }) };
}
