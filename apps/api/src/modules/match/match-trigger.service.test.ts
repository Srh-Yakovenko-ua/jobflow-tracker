import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { FakeMatchRepository, SECOND_APPLICATION_ID } from '../../test/match.js';
import {
  APPLICATION_ID,
  BOHDAN_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { MatchRepository } from './match.repository.js';
import { MatchTriggerService } from './match-trigger.service.js';

const triggerOf = (applicationId: string) => ({
  name: 'match.trigger',
  data: { userId: OLENA_ID, applicationId },
  opts: {
    delay: 5000,
    deduplication: { id: `match:${applicationId}`, ttl: 5000, extend: true, replace: true },
  },
});

async function serviceWith(queue: StubQueue = new StubQueue('match')) {
  const repository = new FakeMatchRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      MatchTriggerService,
      { provide: MatchRepository, useValue: repository },
      { provide: getQueueToken('match'), useValue: queue },
    ],
  }).compile();
  return { queue, repository, service: moduleRef.get(MatchTriggerService) };
}

describe('MatchTriggerService.schedule', () => {
  it('adds one debounced trigger per application in one bulk call', async () => {
    const { queue, service } = await serviceWith();

    expect(await service.schedule(OLENA_ID, [APPLICATION_ID, SECOND_APPLICATION_ID])).toBe(2);

    expect(queue.bulks).toEqual([[triggerOf(APPLICATION_ID), triggerOf(SECOND_APPLICATION_ID)]]);
  });

  it('adds nothing for no applications', async () => {
    const { queue, service } = await serviceWith();

    expect(await service.schedule(OLENA_ID, [])).toBe(0);

    expect(queue.bulks).toEqual([]);
  });

  it('rethrows when the queue refuses the triggers', async () => {
    const { service } = await serviceWith(new RefusingQueue('match'));

    await expect(service.schedule(OLENA_ID, [APPLICATION_ID])).rejects.toThrow(
      'Connection is closed.',
    );
  });

  it('gives up after the publish limit when the queue never answers', async () => {
    const { service } = await serviceWith(new SilentQueue('match'));

    await expect(service.schedule(OLENA_ID, [APPLICATION_ID])).rejects.toThrow(
      'timed out after 2000 ms',
    );
  });
});

describe('MatchTriggerService.rematchVersion', () => {
  it('links the unlinked applications to the active version and schedules every application linked to it', async () => {
    const { queue, repository, service } = await serviceWith();

    expect(await service.rematchVersion(OLENA_ID, RESUME_VERSION_ID)).toBe(1);

    expect(repository.links).toEqual([RESUME_VERSION_ID]);
    expect(queue.bulks).toEqual([[triggerOf(APPLICATION_ID)]]);
  });

  it('schedules the linked applications without linking others when the version is not active', async () => {
    const { queue, repository, service } = await serviceWith();
    repository.activeVersionId = null;

    await service.rematchVersion(OLENA_ID, RESUME_VERSION_ID);

    expect(repository.links).toEqual([]);
    expect(queue.bulks).toEqual([[triggerOf(APPLICATION_ID)]]);
  });

  it("links and schedules nothing for another user's version", async () => {
    const { queue, repository, service } = await serviceWith();

    expect(await service.rematchVersion(BOHDAN_ID, RESUME_VERSION_ID)).toBe(0);

    expect([repository.links, queue.bulks]).toEqual([[], []]);
  });
});

describe('MatchTriggerService.rematchUser', () => {
  it('links the unlinked applications to the active version and schedules every scorable application', async () => {
    const { queue, repository, service } = await serviceWith();

    expect(await service.rematchUser(OLENA_ID)).toBe(2);

    expect(repository.links).toEqual([RESUME_VERSION_ID]);
    expect(queue.bulks).toEqual([[triggerOf(APPLICATION_ID), triggerOf(SECOND_APPLICATION_ID)]]);
  });

  it('links nothing without an active version and still schedules the scorable applications', async () => {
    const { queue, repository, service } = await serviceWith();
    repository.activeVersionId = null;

    expect(await service.rematchUser(OLENA_ID)).toBe(2);

    expect(repository.links).toEqual([]);
    expect(queue.bulks).toHaveLength(1);
  });
});
