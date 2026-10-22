import { type ApplicationResponse, silenceLevelOf, wholeDaysBetween } from '@jobflow/shared';

import type { ApplicationRow } from './applications.repository.js';

type TimingOnlyField = 'stageEvents' | 'createdAt';

export type TimedRow = Pick<ApplicationRow, 'currentStage' | 'lastEventAt' | TimingOnlyField>;

export type ApplicationTimingInput<Row extends TimedRow> = {
  row: Row;
  silenceDays: number;
  now: Date;
};

export type ApplicationTiming = Pick<
  ApplicationResponse,
  'daysInStage' | 'daysSinceLastEvent' | 'silenceLevel'
>;

export type WithApplicationTiming<Row extends TimedRow> = Omit<Row, TimingOnlyField> &
  ApplicationTiming;

export function withApplicationTiming<Row extends TimedRow>({
  row,
  silenceDays,
  now,
}: ApplicationTimingInput<Row>): WithApplicationTiming<Row> {
  const { stageEvents, createdAt, ...columns } = row;
  const stageEnteredAt = stageEvents[0]?.occurredAt ?? createdAt;
  const daysSinceLastEvent = wholeDaysBetween(row.lastEventAt, now);
  return {
    ...columns,
    daysInStage: wholeDaysBetween(stageEnteredAt, now),
    daysSinceLastEvent,
    silenceLevel: silenceLevelOf({ stage: row.currentStage, silenceDays, daysSinceLastEvent }),
  };
}
