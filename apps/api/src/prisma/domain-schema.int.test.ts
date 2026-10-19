import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import { createOwnedApplication } from '../test/factories.js';

describe('the applications domain tables in Postgres', () => {
  const database = useTestDatabase();

  describe('the append-only logs', () => {
    it('refuses an update and a direct delete of a stage event', async () => {
      const { prisma } = database;
      const { applicationId } = await createOwnedApplication(database.prisma);
      const event = await prisma.stageEvent.create({
        data: { applicationId, toStage: 'applied' },
      });

      await expect(
        prisma.$executeRaw`UPDATE stage_events SET comment = 'x' WHERE id = ${event.id}::uuid`,
      ).rejects.toThrow(/stage_events is append-only/);
      await expect(
        prisma.$executeRaw`DELETE FROM stage_events WHERE id = ${event.id}::uuid`,
      ).rejects.toThrow(/stage_events is append-only/);
    });

    it('refuses an update and a direct delete of a timeline event', async () => {
      const { prisma } = database;
      const { applicationId } = await createOwnedApplication(database.prisma);
      const event = await prisma.timelineEvent.create({
        data: { applicationId, kind: 'captured' },
      });

      await expect(
        prisma.$executeRaw`UPDATE timeline_events SET payload = '{"a":1}' WHERE id = ${event.id}::uuid`,
      ).rejects.toThrow(/timeline_events is append-only/);
      await expect(
        prisma.$executeRaw`DELETE FROM timeline_events WHERE id = ${event.id}::uuid`,
      ).rejects.toThrow(/timeline_events is append-only/);
    });

    it('deleting a user removes the events of their applications, an undone move included', async () => {
      const { prisma } = database;
      const { userId, applicationId } = await createOwnedApplication(database.prisma);
      const move = await prisma.stageEvent.create({
        data: { applicationId, fromStage: 'applied', toStage: 'screening' },
      });
      await prisma.stageEvent.create({
        data: {
          applicationId,
          fromStage: 'screening',
          toStage: 'applied',
          compensatesEventId: move.id,
        },
      });
      await prisma.timelineEvent.create({ data: { applicationId, kind: 'note_added' } });

      await prisma.user.delete({ where: { id: userId } });

      const where = { applicationId };
      expect(await prisma.stageEvent.count({ where })).toBe(0);
      expect(await prisma.timelineEvent.count({ where })).toBe(0);
    });
  });

  it('every foreign key has an index that starts with its columns', async () => {
    const rows = await database.prisma.$queryRaw<{ foreign_key: string }[]>`
      SELECT c.conrelid::regclass::text || '.' || c.conname AS foreign_key
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND i.indpred IS NULL
            AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] @> c.conkey
            AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] <@ c.conkey
        )
      ORDER BY 1`;

    expect(rows).toEqual([]);
  });

  describe('applications', () => {
    it('refuses an application without a search', async () => {
      const { prisma } = database;
      const { userId } = await createOwnedApplication(database.prisma);

      await expect(
        prisma.$executeRaw`INSERT INTO applications (user_id, company, position, source)
          VALUES (${userId}::uuid, 'Acme', 'Backend developer', 'djinni')`,
      ).rejects.toThrow(/search_id/);
    });

    it('fills the search vector from the stack of a new application', async () => {
      const { prisma } = database;
      const { userId, searchId } = await createOwnedApplication(database.prisma);

      const rows = await prisma.$queryRaw<{ matches: boolean }[]>`
        INSERT INTO applications (user_id, search_id, company, position, source, stack)
        VALUES (${userId}::uuid, ${searchId}::uuid, 'Globex', 'Data engineer', 'dou', ARRAY['Kafka', 'Go'])
        RETURNING search_vector @@ to_tsquery('simple', 'kafka') AS matches`;

      expect(rows).toEqual([{ matches: true }]);
    });
  });

  describe('searches', () => {
    it('refuses a second active search for the same user', async () => {
      const { userId } = await createOwnedApplication(database.prisma);

      await expect(
        database.prisma.search.create({ data: { userId, title: 'Другий пошук' } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('accepts an archived search beside the active one', async () => {
      const { userId } = await createOwnedApplication(database.prisma);

      const archived = await database.prisma.search.create({
        data: { userId, title: 'Минулий пошук', status: 'archived' },
      });

      expect(archived.status).toBe('archived');
    });
  });
});
