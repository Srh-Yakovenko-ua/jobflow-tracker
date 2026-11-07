import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents, TimelineRecorder } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  BOHDAN_ID,
  MISSING_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { TimelineService } from '../events/index.js';
import { ResumeLinksService } from './resume-links.service.js';
import {
  type ApplicationById,
  type ApplicationLink,
  type RecordResumeEvent,
  type RelinkApplication,
  type ResumeVersionById,
  ResumeVersionsRepository,
} from './resume-versions.repository.js';

const FIRST_VERSION_ID = '0199f0a0-0000-7000-8000-0000000000b2';

const LABEL = { number: 2, title: 'акцент на продукті' };

const RELINK = { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID };

class FakeVersionLinksRepository extends RecordedEvents<RecordResumeEvent> {
  readonly relinks: ByUser<RelinkApplication>[] = [];
  linked: string | null = FIRST_VERSION_ID;

  findVersionLabel(userId: string, { id }: ResumeVersionById) {
    return Promise.resolve(userId === OLENA_ID && id === RESUME_VERSION_ID ? LABEL : null);
  }

  findApplicationLink(
    userId: string,
    { applicationId }: ApplicationById,
  ): Promise<ApplicationLink | null> {
    const owns = userId === OLENA_ID && applicationId === APPLICATION_ID;
    return Promise.resolve(owns ? { resumeVersionId: this.linked } : null);
  }

  relinkApplication(userId: string, input: RelinkApplication): Promise<number> {
    this.relinks.push({ userId, ...input });
    this.linked = input.resumeVersionId;
    return Promise.resolve(1);
  }
}

async function serviceWithFakes() {
  const repository = new FakeVersionLinksRepository();
  const timeline = new TimelineRecorder();
  const moduleRef = await fakeTransactionModule({
    providers: [ResumeLinksService, ResumeVersionsRepository, TimelineService],
    now: NOW,
  })
    .overrideProvider(ResumeVersionsRepository)
    .useValue(repository)
    .overrideProvider(TimelineService)
    .useValue(timeline)
    .compile();
  return { repository, timeline, service: moduleRef.get(ResumeLinksService) };
}

const writesOf = ({ repository, timeline }: Awaited<ReturnType<typeof serviceWithFakes>>) => [
  repository.relinks,
  timeline.events,
  repository.events,
];

describe('ResumeLinksService.relink', () => {
  it('links the application to the version and records resume_attached and resume.attached in its transaction', async () => {
    const { repository, timeline, service } = await serviceWithFakes();

    await service.relink(OLENA_ID, RELINK);

    expect(repository.relinks).toEqual([{ userId: OLENA_ID, ...RELINK, tx: FAKE_TRANSACTION }]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'resume_attached',
        payload: { resumeVersionId: RESUME_VERSION_ID, number: 2, title: 'акцент на продукті' },
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: { eventType: 'resume.attached', ...RELINK },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('writes nothing when the application is already linked to that version', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.linked = RESUME_VERSION_ID;

    await fakes.service.relink(OLENA_ID, RELINK);

    expect(writesOf(fakes)).toEqual([[], [], []]);
  });

  it("answers another user's version with 404 and writes nothing", async () => {
    const fakes = await serviceWithFakes();

    await expect(fakes.service.relink(BOHDAN_ID, RELINK)).rejects.toMatchObject({
      body: { status: 404, type: 'not_found', detail: 'Resume version not found' },
    });
    expect(writesOf(fakes)).toEqual([[], [], []]);
  });

  it('answers an application the user does not own with 404 and writes nothing', async () => {
    const fakes = await serviceWithFakes();

    await expect(
      fakes.service.relink(OLENA_ID, { ...RELINK, applicationId: MISSING_ID }),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect(writesOf(fakes)).toEqual([[], [], []]);
  });
});
