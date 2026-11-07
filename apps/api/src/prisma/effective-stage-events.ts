import { Prisma } from '../generated/prisma/client.js';

export const EFFECTIVE_STAGE_EVENTS = {
  where: { compensatesEventId: null, compensatedBy: { is: null } },
  orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
} satisfies Prisma.Application$stageEventsArgs;

export const EFFECTIVE_STAGE_EVENT_AS_E_SQL = Prisma.sql`e.compensates_event_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM stage_events c
    WHERE c.compensates_event_id = e.id AND c.application_id = e.application_id
  )`;
