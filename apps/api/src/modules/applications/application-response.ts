import { type ApplicationResponse, applicationSchema, DEFAULT_SILENCE_DAYS } from '@jobflow/shared';

import { withApplicationTiming } from './application-timing.js';
import type { ApplicationRow } from './applications.repository.js';

export function toApplicationResponse(row: ApplicationRow, now: Date): ApplicationResponse {
  const { user, ...timed } = row;
  const silenceDays = user.settings?.silenceDays ?? DEFAULT_SILENCE_DAYS;
  const { aiParsed, appliedAt, lastEventAt, updatedAt, ...columns } = withApplicationTiming({
    row: timed,
    silenceDays,
    now,
  });
  return {
    ...columns,
    aiParsed: applicationSchema.shape.aiParsed.parse(aiParsed),
    appliedAt: appliedAt?.toISOString() ?? null,
    lastEventAt: lastEventAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}
