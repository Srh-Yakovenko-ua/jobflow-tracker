import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { traceCarrier } from '../../tracing/trace-context.js';

const AI_REQUESTED_SHAPE = {
  userId: z.uuid(),
  aiJobId: z.uuid(),
  requestId: z.string().min(1).optional(),
};

export function aiRequestedEvent<Shape extends z.ZodRawShape>(type: string, shape: Shape) {
  return { type, schema: z.object({ ...AI_REQUESTED_SHAPE, ...shape }) };
}

export type AiRequestedEvent = { type: string; schema: z.ZodType };

export type AiRequested<Event extends AiRequestedEvent> = Omit<z.infer<Event['schema']>, 'userId'>;

type AiRequestedRow = Prisma.InputJsonObject & { applicationId?: string };

export type AiRequestedOutbox = { event: AiRequestedEvent; requested: AiRequestedRow };

export type RecordAiRequested<Event extends AiRequestedEvent = AiRequestedEvent> = InTransaction & {
  event: Event;
  requested: AiRequested<Event> & AiRequestedRow;
};

export function aiRequestedOutbox(
  userId: string,
  { event, requested }: AiRequestedOutbox,
): Prisma.OutboxEventCreateInput {
  const { applicationId } = requested;
  const aggregate =
    applicationId === undefined
      ? { aggregate: 'user', aggregateId: userId }
      : { aggregate: 'application', aggregateId: applicationId };
  const payload = { userId, ...requested };
  return { ...aggregate, eventType: event.type, payload, ...traceCarrier() };
}
