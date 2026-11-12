import { describe, expect, it } from 'vitest';

import type { AiJobStatus } from '../../generated/prisma/client.js';
import { useTestDatabase } from '../../test/database.js';
import {
  type ApplicationRowInput,
  createActiveVersionOwner,
  createAiJob,
  createResumeVersion,
} from '../../test/factories.js';
import { NOW } from '../../test/time.js';
import { MatchRepository } from './match.repository.js';

describe('MatchRepository trigger reads and links', () => {
  const database = useTestDatabase();

  const repository = () => new MatchRepository(database.prisma);

  const ownerWith = (rows: ApplicationRowInput[]) =>
    createActiveVersionOwner(database.prisma, rows);

  const versionsOf = async (ids: string[]) => {
    const rows = await database.prisma.application.findMany({
      where: { id: { in: ids } },
      select: { id: true, resumeVersionId: true },
    });
    return ids.map((id) => rows.find((row) => row.id === id)?.resumeVersionId);
  };

  it("links OLENA's live unlinked applications to her active version only, never BOHDAN's, and refuses BOHDAN linking hers", async () => {
    const olena = await ownerWith([
      { lastEventAt: NOW },
      { lastEventAt: NOW, isDraft: true },
      { lastEventAt: NOW, deletedAt: NOW },
    ]);
    const otherVersionId = await createResumeVersion(database.prisma, olena.userId);
    const bohdan = await ownerWith([{ lastEventAt: NOW }]);

    const counts = [
      await repository().linkUnlinked(bohdan.userId, olena.activeVersionId),
      await repository().linkUnlinked(olena.userId, otherVersionId),
      await repository().linkUnlinked(olena.userId, olena.activeVersionId),
    ];

    const active = olena.activeVersionId;
    expect(counts).toEqual([0, 0, 2]);
    expect(await versionsOf(olena.ids)).toEqual([active, active, null]);
    expect(await versionsOf(bohdan.ids)).toEqual([null]);
  });

  it("finds OLENA's live applications of a version and her scorable ones, and BOHDAN none of hers", async () => {
    const olena = await ownerWith([
      { lastEventAt: NOW },
      { lastEventAt: NOW, isDraft: true },
      { lastEventAt: NOW, deletedAt: NOW },
    ]);
    const bohdan = await ownerWith([{ lastEventAt: NOW }]);
    await repository().linkUnlinked(olena.userId, olena.activeVersionId);
    const [live = '', draft = ''] = olena.ids;

    const found = {
      linked: await repository().findLinkedIds(olena.userId, olena.activeVersionId),
      foreignLinked: await repository().findLinkedIds(bohdan.userId, olena.activeVersionId),
      scorable: await repository().findScorableIds(olena.userId),
      bohdanScorable: await repository().findScorableIds(bohdan.userId),
      active: await repository().findActiveVersionId(olena.userId),
    };

    expect({ ...found, linked: [...found.linked].sort() }).toEqual({
      linked: [live, draft].sort(),
      foreignLinked: [],
      scorable: [live],
      bohdanScorable: bohdan.ids,
      active: olena.activeVersionId,
    });
  });

  it("keeps the score of OLENA's newer match job when an older one settles last, past a newer failed one, and BOHDAN writes none", async () => {
    const olena = await ownerWith([{ lastEventAt: NOW }]);
    const bohdan = await ownerWith([]);
    await repository().linkUnlinked(olena.userId, olena.activeVersionId);
    const [applicationId = ''] = olena.ids;
    const target = { applicationId, resumeVersionId: olena.activeVersionId };
    const jobOf = (status: AiJobStatus) =>
      createAiJob(database.prisma, { userId: olena.userId, ...target, kind: 'match', status });
    const older = await jobOf('done');
    const newer = await jobOf('processing');
    await jobOf('failed');

    const counts = [
      await repository().saveScore(bohdan.userId, { ...target, aiJobId: newer, score: 40 }),
      await repository().saveScore(olena.userId, { ...target, aiJobId: older, score: 30 }),
      await repository().saveScore(olena.userId, { ...target, aiJobId: newer, score: 40 }),
    ];

    expect(counts).toEqual([0, 0, 1]);
    const { matchScore } = await database.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { matchScore: true },
    });
    expect(matchScore).toBe(40);
  });
});
