import { describe, expect, it } from 'vitest';

import { conflict } from '../../common/app-error.js';
import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import {
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
