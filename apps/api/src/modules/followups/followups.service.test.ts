import { buildFollowupInput, buildFollowupOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import {
  FakeFollowupsRepository,
  FOLLOWUP_SOURCE_ROW,
  RecordingFollowupResolver,
} from '../../test/followup.js';
import { TimelineRecorder } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  MISSING_TARGETS,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { TimelineService } from '../events/index.js';
import { RemindersService } from '../reminders/index.js';
import { FollowupSentService } from './followup-sent.service.js';
import { FollowupsRepository } from './followups.repository.js';
import { FollowupsService } from './followups.service.js';

const RUNNING_JOB_ID = '0199f0a0-0000-7000-8000-0000000000f9';

const WARM = { tone: 'warm', language: 'uk', variant: false } as const;

async function serviceWithFake() {
  const repository = new FakeFollowupsRepository();
  const ai = new FakeAiRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [FollowupsService, FollowupsRepository, { provide: AiService, useValue: ai }],
    now: NOW,
  })
    .overrideProvider(FollowupsRepository)
    .useValue(repository)
    .compile();
  const service = moduleRef.get(FollowupsService);
  const generate = (request: object = WARM, userId = OLENA_ID) =>
    service.request(userId, {
      applicationId: APPLICATION_ID,
      request: { ...WARM, ...request },
      requestId: 'req-1',
    });
  return { repository, ai, service, generate };
}

const BUILT_INPUT = buildFollowupInput({
  lastInterview: { kind: 'tech_interview', date: '2026-10-15' },
  hint: null,
});

describe('FollowupsService.read', () => {
  it('answers the latest draft, its job, the vacancy language and the days of silence', async () => {
    const { repository, service } = await serviceWithFake();
    repository.draft = { finishedAt: daysBefore(1), aiResult: { output: buildFollowupOutput() } };
    repository.job = { id: AI_JOB_ID, status: 'failed', errorType: 'ai_timeout' };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      draft: { ...buildFollowupOutput(), generatedAt: '2026-10-21T09:00:00.000Z' },
      job: { id: AI_JOB_ID, status: 'failed', errorType: 'ai_timeout' },
      language: 'uk',
      silenceDays: 6,
    });
  });

  it.each([
    { case: 'an English vacancy text', rawText: 'Senior React developer у Acme', language: 'en' },
    { case: 'no vacancy text and a Latin position', rawText: null, language: 'en' },
    {
      case: 'a Ukrainian vacancy text',
      rawText: 'Розробник інтерфейсів React, Acme',
      language: 'uk',
    },
  ])('answers $language for $case and no draft before the first one', async (row) => {
    const { repository, service } = await serviceWithFake();
    repository.source = { ...FOLLOWUP_SOURCE_ROW, rawText: row.rawText };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toMatchObject({
      draft: null,
      job: null,
      language: row.language,
    });
  });

  it.each(MISSING_TARGETS)('answers 404 for $case', async ({ userId, id }) => {
    const { service } = await serviceWithFake();

    await expect(service.read(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
  });
});

describe('FollowupsService.request', () => {
  it('creates a followup job and writes the request with the built input in one transaction', async () => {
    const { repository, ai, generate } = await serviceWithFake();

    await expect(generate()).resolves.toEqual({ jobId: AI_JOB_ID });

    expect([...ai.jobs.keys()]).toEqual([AI_JOB_ID]);
    expect(repository.requested).toEqual([
      [
        OLENA_ID,
        {
          requested: {
            applicationId: APPLICATION_ID,
            aiJobId: AI_JOB_ID,
            requestId: 'req-1',
            input: BUILT_INPUT,
          },
          tx: FAKE_TRANSACTION,
        },
      ],
    ]);
  });

  it('marks a variant as fresh and passes the hint and tone through', async () => {
    const { repository, generate } = await serviceWithFake();

    await generate({ variant: true, tone: 'short', language: 'en', hint: 'згадай задачу' });

    expect(repository.requested[0]?.[1].requested).toEqual(
      expect.objectContaining({
        fresh: true,
        input: { ...BUILT_INPUT, tone: 'short', language: 'en', hint: 'згадай задачу' },
      }),
    );
  });

  it('answers the running job instead of creating a second one', async () => {
    const { repository, ai, generate } = await serviceWithFake();
    repository.runningJobId = RUNNING_JOB_ID;

    await expect(generate()).resolves.toEqual({ jobId: RUNNING_JOB_ID });

    expect([ai.jobs.size, repository.requested.length]).toEqual([0, 0]);
  });

  it.each([
    { case: 'a draft', source: { isDraft: true } },
    { case: 'a rejected application', source: { currentStage: 'rejected' } },
    { case: 'an offer', source: { currentStage: 'offer' } },
  ] as const)('answers 409 for $case and creates no job', async ({ source }) => {
    const { repository, ai, generate } = await serviceWithFake();
    repository.source = { ...FOLLOWUP_SOURCE_ROW, ...source };

    await expect(generate()).rejects.toMatchObject({ body: { status: 409, type: 'conflict' } });
    expect([ai.jobs.size, repository.requested.length]).toEqual([0, 0]);
  });

  it.each(MISSING_TARGETS)('answers 404 for $case and creates no job', async ({ userId, id }) => {
    const { repository, ai, service } = await serviceWithFake();

    await expect(
      service.request(userId, { applicationId: id, request: WARM, requestId: 'req-1' }),
    ).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect([ai.jobs.size, repository.requested.length]).toEqual([0, 0]);
  });
});

describe('FollowupSentService.markSent', () => {
  it('records followup_sent now and resolves the follow-up reminder in the same transaction', async () => {
    const timeline = new TimelineRecorder();
    const reminders = new RecordingFollowupResolver();
    const moduleRef = await fakeTransactionModule({
      providers: [
        FollowupSentService,
        { provide: TimelineService, useValue: timeline },
        { provide: RemindersService, useValue: reminders },
      ],
      now: NOW,
    }).compile();

    await moduleRef.get(FollowupSentService).markSent(OLENA_ID, APPLICATION_ID);

    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'followup_sent',
        payload: {},
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(reminders.calls).toEqual([
      [OLENA_ID, { applicationId: APPLICATION_ID, tx: FAKE_TRANSACTION }],
    ]);
  });
});
