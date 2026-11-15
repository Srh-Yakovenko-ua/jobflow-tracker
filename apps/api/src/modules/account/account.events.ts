import { exportFormatSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { traceCarrier } from '../../tracing/trace-context.js';

export const ACCOUNT_EVENTS = { exportRequested: 'export.requested' } as const;

export const exportRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  exportId: z.uuid(),
  format: exportFormatSchema,
  requestId: z.string().min(1),
});

export type ExportRequestedPayload = z.infer<typeof exportRequestedPayloadSchema>;

export type ExportRequested = Omit<ExportRequestedPayload, 'userId'>;

export function exportRequestedEvent(
  userId: string,
  requested: ExportRequested,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'user',
    aggregateId: userId,
    eventType: ACCOUNT_EVENTS.exportRequested,
    payload: { userId, ...requested },
    ...traceCarrier(),
  };
}
