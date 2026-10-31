import { describe, expect, it } from 'vitest';

import type { Prisma } from '../generated/prisma/client.js';
import { useTestDatabase } from '../test/database.js';
import { compensationOf, createOwnedApplication, createStageEvent } from '../test/factories.js';

async function ownerSkippingForeignKeys(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<string[]> {
  const rows = await client.$queryRaw<{ foreign_key: string }[]>`
    SELECT DISTINCT c.conrelid::regclass::text || '.' || c.conname AS foreign_key
    FROM pg_constraint c
    CROSS JOIN unnest(ARRAY['user_id', 'application_id']) AS owner(column_name)
    JOIN pg_attribute source
      ON source.attrelid = c.conrelid AND source.attname = owner.column_name AND NOT source.attisdropped
    JOIN pg_attribute target
      ON target.attrelid = c.confrelid AND target.attname = owner.column_name AND NOT target.attisdropped
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey, c.confkey) AS pair(source_column, target_column)
        WHERE pair.source_column = source.attnum AND pair.target_column = target.attnum
      )
    ORDER BY 1`;
  return rows.map((row) => row.foreign_key);
}

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
      const compensatesEventId = await createStageEvent(prisma, applicationId);
      await prisma.stageEvent.create({
        data: compensationOf({ applicationId, compensatesEventId }),
      });
      await prisma.timelineEvent.create({ data: { applicationId, kind: 'note_added' } });

      await prisma.user.delete({ where: { id: userId } });

      const where = { applicationId };
      expect(await prisma.stageEvent.count({ where })).toBe(0);
      expect(await prisma.timelineEvent.count({ where })).toBe(0);
    });

    it('refuses a second compensation of the same event', async () => {
      const { prisma } = database;
      const { applicationId } = await createOwnedApplication(database.prisma);
      const compensatesEventId = await createStageEvent(prisma, applicationId);
      const undo = compensationOf({ applicationId, compensatesEventId });
      await prisma.stageEvent.create({ data: undo });

      await expect(prisma.stageEvent.create({ data: undo })).rejects.toMatchObject({
        code: 'P2002',
      });
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

  it('no foreign key between two tables of one owner skips the owner column', async () => {
    expect(await ownerSkippingForeignKeys(database.prisma)).toEqual([]);
  });

  it('lists a foreign key that skips the owner column', async () => {
    const rollback = new Error('roll back the catalogue probe');
    let found: string[] = [];

    await expect(
      database.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`ALTER TABLE applications
          ADD CONSTRAINT catalogue_probe_fkey FOREIGN KEY (search_id) REFERENCES searches (id)`;
        found = await ownerSkippingForeignKeys(tx);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(found).toEqual(['applications.catalogue_probe_fkey']);
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

  describe('notes', () => {
    it('fills the search vector of a note and refreshes it when the body changes', async () => {
      const { prisma } = database;
      const { applicationId } = await createOwnedApplication(prisma);

      const [inserted] = await prisma.$queryRaw<{ id: string; matches: boolean }[]>`
        INSERT INTO notes (application_id, body) VALUES (${applicationId}::uuid, 'Офіс у Zürich, питали про Kafka')
        RETURNING id, search_vector @@ jobflow_search_query('zurich kaf') AS matches`;
      const edited = await prisma.$queryRaw<{ matches: boolean }[]>`
        UPDATE notes SET body = 'Офіс у Zürich, тільки Go' WHERE id = ${inserted?.id}::uuid
        RETURNING search_vector @@ jobflow_search_query('zurich kaf') AS matches`;

      expect(inserted?.matches).toBe(true);
      expect(edited).toEqual([{ matches: false }]);
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
