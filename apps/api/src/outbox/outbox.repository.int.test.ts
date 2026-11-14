import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import { createOutboxRows } from '../test/outbox.js';
import { daysBefore, minutesBefore } from '../test/time.js';
import { OutboxRepository } from './outbox.repository.js';

const database = useTestDatabase();

const repository = () => new OutboxRepository(database.prisma);

describe('OutboxRepository.oldestUnpublishedAt on Postgres', () => {
  it('answers when the oldest unpublished row was created, past an older published one', async () => {
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: 'application.created',
      createdAt: daysBefore(3),
      publishedAt: daysBefore(2),
    });
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: 'application.stage_changed',
      createdAt: minutesBefore(5),
    });
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: 'application.created',
      createdAt: daysBefore(1),
    });

    expect(await repository().oldestUnpublishedAt()).toEqual(daysBefore(1));
  });

  it('answers null when every row is published', async () => {
    await createOutboxRows(database.prisma, {
      count: 2,
      eventType: 'application.created',
      publishedAt: daysBefore(1),
    });

    expect(await repository().oldestUnpublishedAt()).toBeNull();
  });
});
