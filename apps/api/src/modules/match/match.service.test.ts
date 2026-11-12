import { buildMatchOutput } from '@jobflow/shared/testing';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import {
  FakeMatchRepository,
  LATEST_MATCH,
  MATCH_SOURCE,
  MATCH_VERSION_LABEL,
} from '../../test/match.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  BOHDAN_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { MatchRepository } from './match.repository.js';
import { MatchService } from './match.service.js';

async function serviceWith(repository = new FakeMatchRepository()) {
  const moduleRef = await Test.createTestingModule({
    providers: [MatchService, { provide: MatchRepository, useValue: repository }],
  }).compile();
  return { repository, service: moduleRef.get(MatchService) };
}

describe('MatchService.read', () => {
  it('answers the breakdown of the latest match for the linked version with its label and time', async () => {
    const { repository, service } = await serviceWith();

    const { match } = await service.read(OLENA_ID, APPLICATION_ID);

    expect(repository.latestReads).toEqual([
      { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID },
    ]);
    expect(match).toMatchObject({
      score: 59,
      missing: [
        { name: 'AWS / інфраструктура', weight: 'must', pointsLost: 27 },
        { name: 'Досвід ліда команди 3+', weight: 'nice', pointsLost: 9 },
      ],
      ignored: [{ name: 'Домен fintech', coverage: 'missing' }],
      resumeVersion: MATCH_VERSION_LABEL,
      computedAt: '2026-10-22T09:00:00.000Z',
    });
  });

  it('answers no match without a read of the jobs when no CV is linked', async () => {
    const repository = new FakeMatchRepository();
    repository.source = { ...MATCH_SOURCE, resumeVersionId: null, resumeVersion: null };
    const { service } = await serviceWith(repository);

    expect(await service.read(OLENA_ID, APPLICATION_ID)).toEqual({ match: null });
    expect(repository.latestReads).toEqual([]);
  });

  it.each([
    { case: 'no match job is done for the version', latest: null },
    { case: 'its AI result was deleted', latest: { ...LATEST_MATCH, aiResult: null } },
    {
      case: 'the stored mapping holds no must or nice requirement',
      latest: { ...LATEST_MATCH, aiResult: { output: buildMatchOutput({ requirements: [] }) } },
    },
  ])('answers no match when $case', async ({ latest }) => {
    const repository = new FakeMatchRepository();
    repository.latest = latest;
    const { service } = await serviceWith(repository);

    expect(await service.read(OLENA_ID, APPLICATION_ID)).toEqual({ match: null });
  });

  it("answers 404 for another user's application", async () => {
    const { repository, service } = await serviceWith();

    await expect(service.read(BOHDAN_ID, APPLICATION_ID)).rejects.toMatchObject(
      APPLICATION_NOT_FOUND,
    );
    expect(repository.latestReads).toEqual([]);
  });
});
