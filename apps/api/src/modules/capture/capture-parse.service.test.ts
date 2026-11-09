import { describe, expect, it } from 'vitest';

import { VACANCY_COMPLETION, VACANCY_JOB, VACANCY_TEXT } from '../../test/ai.js';
import { FakeApplicationDrafts } from '../../test/capture.js';
import { FAKE_TRANSACTION as tx, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, TimelineRecorder } from '../../test/recorded-events.js';
import { APPLICATION_ID, BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import type { SettledAiJob } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { type CreateNote, NotesService } from '../notes/index.js';
import { CaptureParseService } from './capture-parse.service.js';

const JOB = { ...VACANCY_JOB, applicationId: APPLICATION_ID };

const DONE: SettledAiJob = { job: JOB, status: 'done', output: VACANCY_COMPLETION.output };

const FAILED: SettledAiJob = { job: JOB, status: 'failed', errorType: 'no_company_no_position' };

const msAfterNow = (ms: number) => new Date(NOW.getTime() + ms);

class FakeNotes {
  readonly created: ByUser<CreateNote>[] = [];

  create(userId: string, note: CreateNote): Promise<void> {
    this.created.push({ userId, ...note });
    return Promise.resolve();
  }
}

async function serviceWith() {
  const drafts = new FakeApplicationDrafts();
  const timeline = new TimelineRecorder();
  const notes = new FakeNotes();
  const moduleRef = await fakeTransactionModule({
    providers: [
      CaptureParseService,
      { provide: ApplicationDraftsService, useValue: drafts },
      { provide: TimelineService, useValue: timeline },
      { provide: NotesService, useValue: notes },
    ],
    now: NOW,
  }).compile();
  return { drafts, timeline, notes, service: moduleRef.get(CaptureParseService) };
}

describe('CaptureParseService.settle, a done job', () => {
  it('fills the draft and records ai_parsed with the seconds since the capture in one transaction', async () => {
    const { drafts, timeline, notes, service } = await serviceWith();

    await service.settle(DONE);

    expect(drafts.fills).toEqual([
      { userId: OLENA_ID, applicationId: APPLICATION_ID, output: VACANCY_COMPLETION.output, tx },
    ]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'ai_parsed',
        payload: { durationSec: 120 },
        occurredAt: NOW,
        tx,
      },
    ]);
    expect(notes.created).toEqual([]);
  });

  it.each([
    { took: 'under half a second', filledAt: msAfterNow(499), sec: 1 },
    { took: '1.5 seconds', filledAt: msAfterNow(1500), sec: 2 },
    { took: '9 seconds', filledAt: msAfterNow(9000), sec: 9 },
  ])('counts a parse that took $took as $sec s', async ({ filledAt, sec }) => {
    const { drafts, timeline, service } = await serviceWith();
    drafts.filled = { createdAt: NOW, filledAt };

    await service.settle(DONE);

    expect(timeline.events.map(({ payload }) => payload)).toEqual([{ durationSec: sec }]);
  });

  it('records nothing for a draft that was already filled or is gone', async () => {
    const { drafts, timeline, service } = await serviceWith();
    drafts.filled = null;

    await service.settle(DONE);

    expect(timeline.events).toEqual([]);
  });

  it('refuses an output that is no vacancy parse and fills nothing', async () => {
    const { drafts, service } = await serviceWith();

    await expect(service.settle({ ...DONE, output: { company: 'Acme' } })).rejects.toThrow();

    expect(drafts.fills).toEqual([]);
  });
});

describe('CaptureParseService.settle, a failed job', () => {
  it('keeps the pasted text as one note and leaves the draft alone', async () => {
    const { drafts, timeline, notes, service } = await serviceWith();

    await service.settle(FAILED);

    expect(notes.created).toEqual([
      { userId: OLENA_ID, applicationId: APPLICATION_ID, input: { body: VACANCY_TEXT } },
    ]);
    expect([drafts.fills, timeline.events]).toEqual([[], []]);
  });

  it("writes no note for a draft that is gone or another user's", async () => {
    const { notes, service } = await serviceWith();

    await service.settle({ ...FAILED, job: { ...JOB, userId: BOHDAN_ID } });

    expect(notes.created).toEqual([]);
  });
});

describe('CaptureParseService.settle, a job without an application', () => {
  it.each([DONE, FAILED])('touches nothing when a $status job names none', async (settled) => {
    const { drafts, timeline, notes, service } = await serviceWith();

    await service.settle({ ...settled, job: VACANCY_JOB });

    expect([drafts.fills, timeline.events, notes.created]).toEqual([[], [], []]);
  });
});
