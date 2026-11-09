import type { CaptureBookmarkletInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { conflict } from '../../common/app-error.js';
import { AI_JOB_ID, FakeAiRepository, VACANCY_TEXT } from '../../test/ai.js';
import {
  BOOKMARKLET,
  FakeApplicationDrafts,
  OPENED_DRAFT,
  PASTE,
  POSSIBLE_DUPLICATE,
} from '../../test/capture.js';
import { FAKE_TRANSACTION as tx, fakeTransactionModule } from '../../test/fake-prisma.js';
import { TimelineRecorder } from '../../test/recorded-events.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { CaptureService } from './capture.service.js';

const CAPTURE = { input: PASTE, requestId: 'req-capture-1' };

async function serviceWith() {
  const drafts = new FakeApplicationDrafts();
  const ai = new FakeAiRepository();
  const timeline = new TimelineRecorder();
  const moduleRef = await fakeTransactionModule({
    providers: [
      CaptureService,
      { provide: ApplicationDraftsService, useValue: drafts },
      { provide: AiService, useValue: ai },
      { provide: TimelineService, useValue: timeline },
    ],
    now: NOW,
  }).compile();
  return { drafts, ai, timeline, service: moduleRef.get(CaptureService) };
}

describe('CaptureService.paste', () => {
  it('answers the draft id, the ai job id and the possible duplicates', async () => {
    const { service } = await serviceWith();

    await expect(service.paste(OLENA_ID, CAPTURE)).resolves.toEqual({
      applicationId: APPLICATION_ID,
      jobId: AI_JOB_ID,
      possibleDuplicates: [POSSIBLE_DUPLICATE],
    });
  });

  it('opens the draft, queues its ai job, records the capture and announces it in one transaction', async () => {
    const { drafts, ai, timeline, service } = await serviceWith();

    await service.paste(OLENA_ID, CAPTURE);

    expect(drafts.steps).toEqual(['duplicates', 'open']);
    expect(drafts.opened).toEqual([{ userId: OLENA_ID, input: PASTE, tx }]);
    expect(ai.jobs.get(AI_JOB_ID)).toEqual({
      userId: OLENA_ID,
      status: 'queued',
      applicationId: APPLICATION_ID,
    });
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'captured',
        payload: { method: 'paste' },
        occurredAt: OPENED_DRAFT.createdAt,
        tx,
      },
    ]);
    expect(drafts.announced).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        aiJobId: AI_JOB_ID,
        requestId: 'req-capture-1',
        tx,
      },
    ]);
  });

  it('writes no ai job, timeline row or event when no search is active', async () => {
    const { drafts, ai, timeline, service } = await serviceWith();
    drafts.refusal = conflict('No active search');

    await expect(service.paste(OLENA_ID, CAPTURE)).rejects.toMatchObject({
      body: { status: 409, detail: 'No active search' },
    });

    expect([ai.jobs.size, timeline.events, drafts.announced]).toEqual([0, [], []]);
  });
});

describe('CaptureService.bookmarklet', () => {
  async function openedInputOf(page: Partial<CaptureBookmarkletInput>) {
    const { drafts, service } = await serviceWith();
    await service.bookmarklet(OLENA_ID, { ...CAPTURE, input: { ...BOOKMARKLET, ...page } });
    return drafts.opened.map(({ input }) => input);
  }

  it('opens the draft with the page url and the title, a blank line and the page text', async () => {
    expect(await openedInputOf({})).toEqual([
      {
        url: 'https://djinni.co/jobs/700123-senior-react-developer/',
        text: `Senior React developer at Acme\n\n${VACANCY_TEXT}`,
      },
    ]);
  });

  it('takes the text of the html over the text the browser read, without tags or script text', async () => {
    const html = '<h1>Acme</h1><script>stolen()</script><p>Remote &amp; hybrid</p>';

    expect(await openedInputOf({ title: 'React developer', html })).toMatchObject([
      { text: 'React developer\n\nAcme\n\nRemote & hybrid' },
    ]);
  });

  it('falls back to the text the browser read when the html holds no text', async () => {
    const html = '<script>stolen()</script><div> </div>';

    expect(await openedInputOf({ title: 'React developer', text: 'Remote', html })).toMatchObject([
      { text: 'React developer\n\nRemote' },
    ]);
  });

  it('cuts the stored text at 20 000 characters and keeps the title first', async () => {
    const [opened] = await openedInputOf({ title: 'Acme', text: 'a'.repeat(30_000) });

    expect(opened?.text).toBe(`Acme\n\n${'a'.repeat(19_994)}`);
  });

  it('replaces a surrogate pair the cut would split', async () => {
    const [opened] = await openedInputOf({ title: 'Acme', text: `${'a'.repeat(19_993)}😀😀` });

    expect(opened?.text).toBe(`Acme\n\n${'a'.repeat(19_993)}�`);
  });

  it('answers like a paste and records the capture with the bookmarklet method', async () => {
    const { timeline, service } = await serviceWith();

    await expect(
      service.bookmarklet(OLENA_ID, { ...CAPTURE, input: BOOKMARKLET }),
    ).resolves.toEqual({
      applicationId: APPLICATION_ID,
      jobId: AI_JOB_ID,
      possibleDuplicates: [POSSIBLE_DUPLICATE],
    });

    expect(timeline.events.map(({ kind, payload }) => ({ kind, payload }))).toEqual([
      { kind: 'captured', payload: { method: 'bookmarklet' } },
    ]);
  });
});

describe('CaptureService.confirm', () => {
  it('confirms the draft and records one draft_confirmed row at the confirm time in the transaction', async () => {
    const { drafts, timeline, service } = await serviceWith();

    await service.confirm(OLENA_ID, APPLICATION_ID);

    expect(drafts.confirmed).toEqual([{ userId: OLENA_ID, applicationId: APPLICATION_ID, tx }]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'draft_confirmed',
        payload: {},
        occurredAt: NOW,
        tx,
      },
    ]);
  });

  it('records no timeline row when the draft cannot be confirmed', async () => {
    const { drafts, timeline, service } = await serviceWith();
    drafts.refusal = conflict('Application is not a draft');

    await expect(service.confirm(OLENA_ID, APPLICATION_ID)).rejects.toMatchObject({
      body: { status: 409, detail: 'Application is not a draft' },
    });

    expect(timeline.events).toEqual([]);
  });
});
