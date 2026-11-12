import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import { createActiveVersionOwner, randomEmail } from '../test/factories.js';
import { StubQueue, stubQueues } from '../test/stub-queues.js';
import { NOW } from '../test/time.js';
import { AiRematchModule } from './ai-rematch.module.js';
import { AiRematchService } from './ai-rematch.service.js';

describe('AiRematchService.rematch', () => {
  const database = useTestDatabase();
  let moduleRef: TestingModule;
  const queue = new StubQueue('match');

  beforeAll(async () => {
    const builder = Test.createTestingModule({ imports: [AiRematchModule] });
    moduleRef = await stubQueues(builder, { match: queue }).compile();
  });
  beforeEach(() => {
    queue.jobs.length = 0;
  });
  afterAll(() => moduleRef.close());

  const userWithApplications = () =>
    createActiveVersionOwner(database.prisma, [
      { lastEventAt: NOW },
      { lastEventAt: NOW, isDraft: true },
      { lastEventAt: NOW },
    ]);

  const versionIdsOf = async (userId: string) =>
    (
      await database.prisma.application.findMany({
        where: { userId },
        select: { resumeVersionId: true },
      })
    ).map(({ resumeVersionId }) => resumeVersionId);

  it("links OLENA's unlinked applications to her active CV and schedules her non-draft ones, leaving BOHDAN's alone", async () => {
    const olena = await userWithApplications();
    const bohdan = await userWithApplications();
    const [first = '', , third = ''] = olena.ids;

    const queued = await moduleRef.get(AiRematchService).rematch(olena.email);

    expect(queued).toBe(2);
    expect(new Set(queue.jobs.map(({ data }) => data))).toEqual(
      new Set([
        { userId: olena.userId, applicationId: first },
        { userId: olena.userId, applicationId: third },
      ]),
    );
    expect(await versionIdsOf(olena.userId)).toEqual(Array(3).fill(olena.activeVersionId));
    expect(await versionIdsOf(bohdan.userId)).toEqual([null, null, null]);
  });

  it('answers null and schedules nothing for an unknown email', async () => {
    await userWithApplications();

    expect(await moduleRef.get(AiRematchService).rematch(randomEmail())).toBeNull();
    expect(queue.jobs).toEqual([]);
  });
});
