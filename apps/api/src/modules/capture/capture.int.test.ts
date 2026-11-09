import {
  type CapturePasteResponse,
  capturePasteResponseSchema,
  timelineRecordSchema,
} from '@jobflow/shared';
import { buildVacancyCompletion, buildVacancyParseOutput } from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prisma } from '../../generated/prisma/client.js';
import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { QUEUES } from '../../queues/queues.js';
import {
  FakeAiClient,
  NAMELESS_VACANCY_COMPLETION,
  PARSED_VACANCY_COLUMNS,
  storedAiJob,
  VACANCY_COMPLETION,
  VACANCY_TEXT,
} from '../../test/ai.js';
import { rateLimitedTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationEventRow,
  applicationPath,
  createApplication,
  getApplicationBoard,
  ROMASHKA,
  signedInWithSearch,
  stageEventsOf,
} from '../../test/applications.js';
import { accessTokenFor } from '../../test/auth.js';
import { overrideBullConfig, REFUSED_REDIS } from '../../test/bull-config.js';
import {
  BLANK_DRAFT_COLUMNS,
  CAPTURE_PASTE_PATH,
  PASTE,
  PASTED_URL,
  postConfirm,
  postPaste,
} from '../../test/capture.js';
import { createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf, statusAndDetail } from '../../test/http.js';
import { expectReplayedCreate } from '../../test/idempotency.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';
import { outboxRows } from '../../test/outbox.js';
import { expectRateLimited } from '../../test/rate-limit.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient, AiServiceError } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';

vi.hoisted(() => {
  vi.stubEnv('RATE_LIMIT_AI_PER_HOUR', '6');
});

const PLACEHOLDER_DRAFT = {
  ...BLANK_DRAFT_COLUMNS,
  url: PASTED_URL,
  currentStage: 'applied',
  isDraft: true,
  rawText: VACANCY_TEXT,
  aiParsed: null,
};

const PARSED_DRAFT = {
  ...PLACEHOLDER_DRAFT,
  ...PARSED_VACANCY_COLUMNS,
  isDraft: false,
  aiParsed: VACANCY_COMPLETION.output,
};

const LOCATION_TO_CHECK = buildVacancyParseOutput({
  location: { value: 'Львів', confidence: 'check', evidence: 'Lviv or remote' },
});

const CHECKED_DRAFT = {
  ...PARSED_DRAFT,
  location: 'Львів',
  isDraft: true,
  aiParsed: LOCATION_TO_CHECK,
};

const FILL_FIELDS = [...Object.keys(PARSED_VACANCY_COLUMNS), 'aiParsed'];

const SIX_VACANCIES = Array.from(
  { length: 6 },
  (_, index) => `${VACANCY_TEXT}\nVacancy ${String(index + 1)}`,
);

const DRAFT_COLUMNS = {
  company: true,
  position: true,
  source: true,
  url: true,
  currentStage: true,
  isDraft: true,
  rawText: true,
  aiParsed: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  stack: true,
  location: true,
  workMode: true,
} satisfies Prisma.ApplicationSelect;

const AI_QUEUE_AFTER_ONE_PARSE = { waiting: 0, active: 0, delayed: 0, completed: 1 };

const WORKER_TEST = { timeout: 30_000 };

const SETTLED = { timeout: 20_000 };

const log = memoryLog();

const ai = new FakeAiClient();

describe('POST /api/v1/capture/paste', () => {
  const testApp = useTestApp(() =>
    overrideBullConfig(withLogSink(rateLimitedTestingModule(), log.sink), REFUSED_REDIS),
  );
  const workers = useTestWorkers(log.sink, (builder) =>
    builder.overrideProvider(AiClient).useValue(ai),
  );

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(VACANCY_COMPLETION);
  });

  async function paste(accessToken: string, input: object = PASTE) {
    const response = await postPaste(testApp.app, { accessToken, input });
    expect(statusAndDetail(response)).toEqual([202, undefined]);
    const requestId = response.get('x-request-id');
    return { ...capturePasteResponseSchema.parse(response.body), requestId };
  }

  const draftOf = (id: string) =>
    testApp.prisma.application.findUniqueOrThrow({ where: { id }, select: DRAFT_COLUMNS });

  const timelineOf = (applicationId: string) =>
    testApp.prisma.timelineEvent.findMany({
      where: { applicationId },
      orderBy: { id: 'asc' },
      select: { kind: true, payload: true },
    });

  const notesOf = (applicationId: string) =>
    testApp.prisma.note.findMany({ where: { applicationId }, select: { body: true } });

  const countRows = () =>
    Promise.all([
      testApp.prisma.application.count(),
      testApp.prisma.aiJob.count(),
      testApp.prisma.timelineEvent.count(),
      testApp.prisma.outboxEvent.count(),
    ]);

  async function boardCardOf(accessToken: string) {
    const { columns } = await getApplicationBoard(testApp.app, { accessToken });
    return (columns.applied.items ?? []).map(({ id, isDraft, aiStatus }) => ({
      id,
      isDraft,
      aiStatus,
    }));
  }

  async function relayingWorker(): Promise<INestApplicationContext> {
    const compiled = await workers.compile();
    const worker = await compiled.init();
    await worker.get(OutboxRelayService, { strict: false }).relay();
    return worker;
  }

  async function relayed({ jobId }: CapturePasteResponse, status: string) {
    const worker = await relayingWorker();
    await expect
      .poll(async () => (await storedAiJob(testApp.prisma, jobId)).status, SETTLED)
      .toBe(status);
    return worker;
  }

  async function kindsOf(applicationId: string) {
    const timeline = await timelineOf(applicationId);
    return timeline.map(({ kind }) => kind);
  }

  function confirmAs(userId: string, applicationId: string) {
    const drafts = testApp.app.get(ApplicationDraftsService, { strict: false });
    return testApp.prisma.$transaction((tx) => drafts.confirm(userId, { applicationId, tx }));
  }

  async function capturedToCheck() {
    ai.answer = () => Promise.resolve(buildVacancyCompletion({ output: LOCATION_TO_CHECK }));
    const olena = await signedInWithSearch(testApp.prisma);
    const captured = await paste(olena.accessToken);
    await relayed(captured, 'done');
    return { ...olena, ...captured };
  }

  const expectTextKeptAsNote = (applicationId: string) =>
    expect.poll(() => kindsOf(applicationId), SETTLED).toEqual(['captured', 'note_added']);

  async function updatesOf(applicationId: string) {
    const updates = await outboxRows(testApp.prisma, {
      eventType: 'application.updated',
      aggregateId: applicationId,
    });
    return updates.map(({ payload }) => payload);
  }

  function fillAs(userId: string, applicationId: string) {
    const drafts = testApp.app.get(ApplicationDraftsService, { strict: false });
    const output = buildVacancyParseOutput();
    return testApp.prisma.$transaction((tx) => drafts.fill(userId, { applicationId, output, tx }));
  }

  it('answers 202 while the queue Redis is down and stores the draft, its queued ai job, the captured timeline row and the capture event', async () => {
    const { userId, accessToken } = await signedInWithSearch(testApp.prisma);

    const { applicationId, jobId, possibleDuplicates, requestId } = await paste(accessToken);

    expect(possibleDuplicates).toEqual([]);
    expect(await draftOf(applicationId)).toEqual(PLACEHOLDER_DRAFT);
    expect(await stageEventsOf(testApp.prisma, applicationId)).toEqual([
      expect.objectContaining({ fromStage: null, toStage: 'applied' }),
    ]);
    expect(await storedAiJob(testApp.prisma, jobId)).toEqual({
      status: 'queued',
      errorType: null,
      aiResultId: null,
      finishedAt: null,
    });
    expect(await timelineOf(applicationId)).toEqual([
      { kind: 'captured', payload: { method: 'paste' } },
    ]);
    expect(await outboxRows(testApp.prisma)).toEqual([
      applicationEventRow({
        eventType: 'application.capture_requested',
        applicationId,
        aiJobId: jobId,
        requestId,
        userId,
      }),
    ]);
    expect(ai.calls).toEqual([]);
  });

  it('shows the draft on the board in the applied column with a queued ai status', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const { applicationId } = await paste(accessToken);

    expect(await boardCardOf(accessToken)).toEqual([
      { id: applicationId, isDraft: true, aiStatus: 'queued' },
    ]);
  });

  it('stores no url when the paste carries only text', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const { applicationId } = await paste(accessToken, { text: VACANCY_TEXT });

    expect(await draftOf(applicationId)).toEqual({ ...PLACEHOLDER_DRAFT, url: null });
  });

  it('answers 401 without a token', async () => {
    const response = await postPaste(testApp.app, { input: PASTE });

    expect(response.status).toBe(401);
    expect(await countRows()).toEqual([0, 0, 0, 0]);
  });

  it.each([
    { paste: 'without text', input: { url: PASTED_URL }, path: 'text' },
    { paste: 'with blank text', input: { text: ' \n ' }, path: 'text' },
    { paste: 'with 20001 characters', input: { text: 'a'.repeat(20_001) }, path: 'text' },
    {
      paste: 'with an ftp url',
      input: { ...PASTE, url: 'ftp://jobs.example.test/7' },
      path: 'url',
    },
  ])('answers 422 naming $path for a paste $paste and stores nothing', async ({ input, path }) => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const response = await postPaste(testApp.app, { accessToken, input });

    expect(response.status).toBe(422);
    expect(errorPathsOf(response.body)).toEqual([path]);
    expect(await countRows()).toEqual([0, 0, 0, 0]);
  });

  it('answers 409 and stores nothing when the user has no active search', async () => {
    const accessToken = await accessTokenFor(await createUser(testApp.prisma));

    const response = await postPaste(testApp.app, { accessToken, input: PASTE });

    expect(statusAndDetail(response)).toEqual([409, 'No active search']);
    expect(await countRows()).toEqual([0, 0, 0, 0]);
  });

  it('answers the first reply again for a repeated Idempotency-Key and stores one draft', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    await expectReplayedCreate({
      app: testApp.app,
      call: { method: 'post', path: CAPTURE_PASTE_PATH, body: PASTE, accessToken },
      countRows,
      status: 202,
    });
  });

  it("lists the user's own Application with the pasted url as a possible duplicate, and not another user's", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const existing = await createApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: { ...ROMASHKA, url: PASTED_URL },
    });

    const olenas = await paste(olena.accessToken);
    const bohdans = await paste(bohdan.accessToken);

    expect(olenas.possibleDuplicates).toEqual([
      {
        id: existing.id,
        company: 'Ромашка',
        position: 'Backend developer',
        stage: 'applied',
        appliedAt: existing.appliedAt,
      },
    ]);
    expect(bohdans.possibleDuplicates).toEqual([]);
  });

  it('answers the seventh paste of one user in an hour with 429 when RATE_LIMIT_AI_PER_HOUR is 6, and not another user', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    for (let pasted = 0; pasted < 6; pasted += 1) {
      await paste(olena.accessToken);
    }

    const seventh = await postPaste(testApp.app, { accessToken: olena.accessToken, input: PASTE });

    expectRateLimited(seventh, { windowSeconds: 3600 });
    await paste(bohdan.accessToken);
  });

  it('keeps another user away from the draft: 404 on its route, no text read and no fill', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const { applicationId } = await paste(olena.accessToken);
    const drafts = testApp.app.get(ApplicationDraftsService, { strict: false });

    const read = await callRoute(testApp.app, {
      method: 'get',
      path: applicationPath(applicationId),
      accessToken: bohdan.accessToken,
    });

    expect(read.status).toBe(404);
    expect(await drafts.findRawText(bohdan.userId, applicationId)).toBeNull();
    expect(await fillAs(bohdan.userId, applicationId)).toBeNull();
    expect(await draftOf(applicationId)).toEqual(PLACEHOLDER_DRAFT);
    expect(await drafts.findRawText(olena.userId, applicationId)).toBe(VACANCY_TEXT);
    expect(await fillAs(olena.userId, applicationId)).not.toBeNull();
    expect(await draftOf(applicationId)).toMatchObject({ company: 'Acme', isDraft: false });
    expect(await fillAs(olena.userId, applicationId)).toBeNull();
  });

  it(
    'fills the draft from the parse in the worker, clears the draft flag and records ai_parsed',
    WORKER_TEST,
    async () => {
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const captured = await paste(accessToken);

      await relayed(captured, 'done');

      const [, parsed] = await timelineOf(captured.applicationId);
      expect(await draftOf(captured.applicationId)).toEqual(PARSED_DRAFT);
      expect(await kindsOf(captured.applicationId)).toEqual(['captured', 'ai_parsed']);
      expect(timelineRecordSchema.safeParse(parsed).error).toBeUndefined();
      expect(await boardCardOf(accessToken)).toEqual([
        { id: captured.applicationId, isDraft: false, aiStatus: 'done' },
      ]);
      expect(ai.calls).toEqual([
        { kind: 'vacancy_parse', input: { text: VACANCY_TEXT }, requestId: captured.requestId },
      ]);
      expect(await notesOf(captured.applicationId)).toEqual([]);
    },
  );

  it(
    'creates six drafts at once for six pastes in a row and fills each from its own parse',
    WORKER_TEST,
    async () => {
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const ids: string[] = [];
      for (const text of SIX_VACANCIES) {
        const { applicationId } = await paste(accessToken, { text });
        ids.push(applicationId);
      }
      const cardsWith = (state: { isDraft: boolean; aiStatus: string }) =>
        new Set(ids.map((id) => ({ id, ...state })));

      expect(new Set(await boardCardOf(accessToken))).toEqual(
        cardsWith({ isDraft: true, aiStatus: 'queued' }),
      );
      expect(ai.calls).toEqual([]);

      await relayingWorker();

      await expect
        .poll(async () => new Set(await boardCardOf(accessToken)), SETTLED)
        .toEqual(cardsWith({ isDraft: false, aiStatus: 'done' }));
      expect(await Promise.all(ids.map(draftOf))).toEqual(
        SIX_VACANCIES.map((rawText) => ({ ...PARSED_DRAFT, url: null, rawText })),
      );
      expect(await Promise.all(ids.map(kindsOf))).toEqual(ids.map(() => ['captured', 'ai_parsed']));
      expect(new Set(ai.calls.map(({ input }) => input))).toEqual(
        new Set(SIX_VACANCIES.map((text) => ({ text }))),
      );
    },
  );

  it('keeps the draft flag when the parse marks a field to check', WORKER_TEST, async () => {
    const { applicationId } = await capturedToCheck();

    expect(await draftOf(applicationId)).toEqual(CHECKED_DRAFT);
  });

  it('parses once when the capture event is delivered twice', WORKER_TEST, async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);
    const captured = await paste(accessToken);
    const worker = await relayed(captured, 'done');
    const { id, eventType, payload } = await testApp.prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: 'application.capture_requested' },
      select: { id: true, eventType: true, payload: true },
    });
    const aiQueue = worker.get<Queue>(getQueueToken(QUEUES.ai.name));

    await worker.get(DomainEventRouter, { strict: false }).route({ id, type: eventType, payload });

    await expect
      .poll(() => aiQueue.getJobCounts('waiting', 'active', 'delayed', 'completed'), SETTLED)
      .toEqual(AI_QUEUE_AFTER_ONE_PARSE);
    expect(ai.calls).toHaveLength(1);
    expect(await kindsOf(captured.applicationId)).toEqual(['captured', 'ai_parsed']);
  });

  it.each([
    {
      failure: 'services/ai refuses the text with 422',
      answer: () => Promise.reject(new AiServiceError({ status: 422, type: 'ai_invalid_output' })),
      errorType: 'ai_invalid_output',
    },
    {
      failure: 'the parse names no company and no position',
      answer: () => Promise.resolve(NAMELESS_VACANCY_COMPLETION),
      errorType: 'no_company_no_position',
    },
  ])(
    'leaves the draft and keeps the pasted text as one note when $failure',
    WORKER_TEST,
    async ({ answer, errorType }) => {
      ai.answer = answer;
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const captured = await paste(accessToken);

      await relayed(captured, 'failed');

      await expect
        .poll(() => notesOf(captured.applicationId), SETTLED)
        .toEqual([{ body: VACANCY_TEXT }]);
      expect(await storedAiJob(testApp.prisma, captured.jobId)).toMatchObject({ errorType });
      expect(await draftOf(captured.applicationId)).toEqual(PLACEHOLDER_DRAFT);
      expect(await boardCardOf(accessToken)).toEqual([
        { id: captured.applicationId, isDraft: true, aiStatus: 'failed' },
      ]);
      expect(await kindsOf(captured.applicationId)).toEqual(['captured', 'note_added']);
    },
  );

  describe('POST /api/v1/capture/drafts/:id/confirm', () => {
    it(
      'clears the draft flag of a parsed draft with a field to check, records draft_confirmed and application.updated, and answers 409 to a second confirm',
      WORKER_TEST,
      async () => {
        const { userId, accessToken, applicationId } = await capturedToCheck();

        const first = await postConfirm(testApp.app, { accessToken, id: applicationId });
        const second = await postConfirm(testApp.app, { accessToken, id: applicationId });

        expect(statusAndDetail(first)).toEqual([204, undefined]);
        expect(statusAndDetail(second)).toEqual([409, 'Application is not a draft']);
        expect(await draftOf(applicationId)).toEqual({ ...CHECKED_DRAFT, isDraft: false });
        expect(await boardCardOf(accessToken)).toEqual([
          { id: applicationId, isDraft: false, aiStatus: 'done' },
        ]);
        expect(await kindsOf(applicationId)).toEqual(['captured', 'ai_parsed', 'draft_confirmed']);
        expect((await timelineOf(applicationId)).at(-1)).toEqual({
          kind: 'draft_confirmed',
          payload: {},
        });
        expect(await updatesOf(applicationId)).toEqual([
          { userId, applicationId, fields: FILL_FIELDS },
          { userId, applicationId, fields: ['isDraft'] },
        ]);
      },
    );

    it(
      "answers 404 to another user's token and 401 without a token, and leaves the draft for its owner to confirm",
      WORKER_TEST,
      async () => {
        const { accessToken, applicationId: id } = await capturedToCheck();
        const bohdan = await signedInWithSearch(testApp.prisma);

        const foreign = await postConfirm(testApp.app, { accessToken: bohdan.accessToken, id });
        const anonymous = await postConfirm(testApp.app, { id });

        expect(statusAndDetail(foreign)).toEqual([404, 'Application not found']);
        await expect(confirmAs(bohdan.userId, id)).rejects.toMatchObject({
          body: { status: 404, detail: 'Application not found' },
        });
        expect(anonymous.status).toBe(401);
        expect(await draftOf(id)).toEqual(CHECKED_DRAFT);
        expect(await kindsOf(id)).toEqual(['captured', 'ai_parsed']);
        expect((await postConfirm(testApp.app, { accessToken, id })).status).toBe(204);
      },
    );

    it('answers 422 for an id that is not a uuid', async () => {
      const { accessToken } = await signedInWithSearch(testApp.prisma);

      const response = await postConfirm(testApp.app, { accessToken, id: 'not-a-uuid' });

      expect(response.status).toBe(422);
    });

    it.each(['queued', 'processing'] as const)(
      'answers 409 while the vacancy parse is %s and leaves the draft as it was',
      async (status) => {
        const { accessToken } = await signedInWithSearch(testApp.prisma);
        const { applicationId, jobId } = await paste(accessToken);
        await testApp.prisma.aiJob.update({
          where: { id: jobId },
          data: { status },
          select: { id: true },
        });

        const response = await postConfirm(testApp.app, { accessToken, id: applicationId });

        expect(statusAndDetail(response)).toEqual([409, 'Vacancy parse is still running']);
        expect(await draftOf(applicationId)).toEqual(PLACEHOLDER_DRAFT);
        expect(await kindsOf(applicationId)).toEqual(['captured']);
      },
    );

    it('confirms a draft whose vacancy parse failed', WORKER_TEST, async () => {
      ai.answer = () =>
        Promise.reject(new AiServiceError({ status: 422, type: 'ai_invalid_output' }));
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const captured = await paste(accessToken);
      await relayed(captured, 'failed');
      await expectTextKeptAsNote(captured.applicationId);

      const response = await postConfirm(testApp.app, { accessToken, id: captured.applicationId });

      expect(statusAndDetail(response)).toEqual([204, undefined]);
      expect(await draftOf(captured.applicationId)).toEqual({
        ...PLACEHOLDER_DRAFT,
        isDraft: false,
      });
      expect(await kindsOf(captured.applicationId)).toEqual([
        'captured',
        'note_added',
        'draft_confirmed',
      ]);
    });
  });

  it(
    'keeps a position the user changed while the parse was queued and fills the other fields',
    WORKER_TEST,
    async () => {
      const { userId, accessToken } = await signedInWithSearch(testApp.prisma);
      const captured = await paste(accessToken);
      const { applicationId } = captured;
      const edit = await callRoute(testApp.app, {
        method: 'patch',
        path: applicationPath(applicationId),
        body: { position: 'Lead React developer' },
        accessToken,
      });

      await relayed(captured, 'done');

      expect(edit.status).toBe(200);
      expect(await draftOf(applicationId)).toEqual({
        ...PARSED_DRAFT,
        position: 'Lead React developer',
      });
      expect(await updatesOf(applicationId)).toEqual([
        { userId, applicationId, fields: ['position'] },
        {
          userId,
          applicationId,
          fields: [...FILL_FIELDS.filter((field) => field !== 'position'), 'isDraft'],
        },
      ]);
    },
  );
});
