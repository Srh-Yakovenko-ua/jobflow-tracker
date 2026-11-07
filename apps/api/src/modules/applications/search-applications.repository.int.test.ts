import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../../test/database.js';
import { createOwnedApplication, createSearch } from '../../test/factories.js';
import { WITHDRAWAL } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { SearchApplicationsRepository, type Withdrawal } from './search-applications.repository.js';

const database = useTestDatabase();

const repository = () => new SearchApplicationsRepository(database.prisma);

const owners = async () => ({
  olena: await createOwnedApplication(database.prisma),
  bohdan: await createOwnedApplication(database.prisma),
});

const withdrawalOf = (applicationId: string): Withdrawal => ({
  events: [{ ...WITHDRAWAL, applicationId, fromStage: 'applied' }],
  lastEventAt: NOW,
});

const storedApplication = (id: string) =>
  database.prisma.application.findUniqueOrThrow({
    where: { id },
    select: { currentStage: true, searchId: true },
  });

describe("SearchApplicationsRepository on another user's search", () => {
  it("lockOpen finds none of BOHDAN's open applications for OLENA", async () => {
    const { olena, bohdan } = await owners();

    await expect(
      repository().lockOpen(olena.userId, { searchId: bohdan.searchId }),
    ).resolves.toEqual([]);
    await expect(
      repository().lockOpen(bohdan.userId, { searchId: bohdan.searchId }),
    ).resolves.toEqual([{ id: bohdan.applicationId, currentStage: 'applied' }]);
  });

  it("totalsOf gives OLENA no totals for BOHDAN's search", async () => {
    const { olena, bohdan } = await owners();

    await expect(repository().totalsOf(olena.userId, [bohdan.searchId])).resolves.toEqual([]);
    await expect(repository().totalsOf(bohdan.userId, [bohdan.searchId])).resolves.toEqual([
      { searchId: bohdan.searchId, applications: 1, interviews: 0, offers: 0, firstOfferAt: null },
    ]);
  });

  it("withdraw by OLENA leaves BOHDAN's application in applied", async () => {
    const { olena, bohdan } = await owners();

    await expect(
      repository().withdraw(olena.userId, withdrawalOf(bohdan.applicationId)),
    ).resolves.toBe(0);
    expect(await storedApplication(bohdan.applicationId)).toEqual({
      currentStage: 'applied',
      searchId: bohdan.searchId,
    });
    await expect(
      repository().withdraw(bohdan.userId, withdrawalOf(bohdan.applicationId)),
    ).resolves.toBe(1);
  });

  it("moveTo by OLENA leaves BOHDAN's application in his search", async () => {
    const { olena, bohdan } = await owners();
    const move = {
      ids: [bohdan.applicationId],
      fromSearchId: bohdan.searchId,
      toSearchId: await createSearch(database.prisma, {
        userId: bohdan.userId,
        status: 'archived',
      }),
    };

    await expect(repository().moveTo(olena.userId, move)).resolves.toBe(0);
    expect(await storedApplication(bohdan.applicationId)).toEqual({
      currentStage: 'applied',
      searchId: bohdan.searchId,
    });
    await expect(repository().moveTo(bohdan.userId, move)).resolves.toBe(1);
  });
});
