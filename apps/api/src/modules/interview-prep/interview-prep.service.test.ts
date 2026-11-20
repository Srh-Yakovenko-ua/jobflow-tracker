import { INTERVIEW_PREP_OUTPUT } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { FakeMatchReader } from '../../test/cv-hints.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import {
  FakeInterviewPrepRepository,
  INTERVIEW_PREP_SOURCE_ROW,
} from '../../test/interview-prep.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  MISSING_TARGETS,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { minutesAfter, NOW } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { MatchService } from '../match/index.js';
import { InterviewPrepRepository } from './interview-prep.repository.js';
import { InterviewPrepService } from './interview-prep.service.js';
import { InterviewPrepSources } from './interview-prep-sources.service.js';
import { INTERVIEW_PREP_REFUSALS } from './interview-prep-vacancy.js';

const RUNNING_JOB_ID = '0199f0a0-0000-7000-8000-0000000000f9';

const BUILT_VACANCY = {
  position: 'Senior React developer',
  interviewKind: 'tech_interview',
  requirements: ['React + TypeScript', 'Node.js у проді', 'React', 'GraphQL'],
  gaps: [
    { name: 'AWS / інфраструктура', coverage: 'missing' },
    { name: 'Досвід ліда команди 3+', coverage: 'missing' },
    { name: 'GraphQL', coverage: 'partial' },
  ],
};

async function serviceWithFakes() {
  const repository = new FakeInterviewPrepRepository();
  const match = new FakeMatchReader();
  const ai = new FakeAiRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [
      InterviewPrepService,
      InterviewPrepSources,
      { provide: InterviewPrepRepository, useValue: repository },
      { provide: MatchService, useValue: match },
      { provide: AiService, useValue: ai },
    ],
    now: NOW,
  }).compile();
  const service = moduleRef.get(InterviewPrepService);
  const generate = (userId = OLENA_ID, applicationId = APPLICATION_ID) =>
    service.request(userId, { applicationId, requestId: 'req-1' });
  const suggest = (userId = OLENA_ID, applicationId = APPLICATION_ID) =>
    moduleRef
      .get(PrismaService)
      .$transaction((tx) => service.suggest(userId, { applicationId, tx }));
  return { repository, match, ai, service, generate, suggest };
}

type Fakes = Awaited<ReturnType<typeof serviceWithFakes>>;

const nothingStored = ({ ai }: Fakes) => [ai.jobs.size, ai.requested.length];

const requestedInput = ({ ai }: Fakes) => ai.requested[0]?.[1].requested.input;

const withoutInterview = ({ repository }: Fakes) => {
  repository.source = { ...INTERVIEW_PREP_SOURCE_ROW, scheduledEvents: [] };
};

describe('InterviewPrepService.read', () => {
  it('answers the pack of the latest done job', async () => {
    const { repository, service } = await serviceWithFakes();
    repository.latest = {
      id: AI_JOB_ID,
      status: 'done',
      errorType: null,
      finishedAt: minutesAfter(5),
      aiResult: { output: INTERVIEW_PREP_OUTPUT },
    };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      result: { ...INTERVIEW_PREP_OUTPUT, generatedAt: '2026-10-22T09:05:00.000Z' },
      job: { id: AI_JOB_ID, status: 'done', errorType: null },
    });
  });

  it('answers no pack and no job before the first request', async () => {
    const { service } = await serviceWithFakes();

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      result: null,
      job: null,
    });
  });
});

describe('InterviewPrepService.request', () => {
  it('creates an interview_prep job and writes the request with the parsed requirements, the stack, the gaps and the interview kind in one transaction', async () => {
    const fakes = await serviceWithFakes();

    expect(await fakes.generate()).toEqual({ jobId: AI_JOB_ID });

    expect(fakes.ai.jobs.get(AI_JOB_ID)).toMatchObject({ applicationId: APPLICATION_ID });
    expect(fakes.ai.requested).toEqual([
      [
        OLENA_ID,
        {
          eventType: 'application.interview_prep_requested',
          requested: {
            applicationId: APPLICATION_ID,
            aiJobId: AI_JOB_ID,
            requestId: 'req-1',
            input: BUILT_VACANCY,
          },
          tx: FAKE_TRANSACTION,
        },
      ],
    ]);
    expect(fakes.repository.sourceReads).toEqual([{ applicationId: APPLICATION_ID, now: NOW }]);
  });

  it('builds the pack with no gaps for an application without a Match Score', async () => {
    const fakes = await serviceWithFakes();
    fakes.match.response = { match: null, job: null };

    await fakes.generate();

    expect(requestedInput(fakes)).toEqual({ ...BUILT_VACANCY, gaps: [] });
  });

  it('takes the requirements from the stack alone when the vacancy was never parsed', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.source = { ...INTERVIEW_PREP_SOURCE_ROW, aiParsed: { seniority: 'middle' } };

    await fakes.generate();

    expect(requestedInput(fakes)).toMatchObject({ requirements: ['React', 'GraphQL'] });
  });

  it('answers the running job to a request and true to a suggestion, creating no second job', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.runningJobId = RUNNING_JOB_ID;

    const answers = [await fakes.generate(), await fakes.suggest()];

    expect(answers).toEqual([{ jobId: RUNNING_JOB_ID }, true]);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it.each([
    {
      case: 'no interview is planned ahead',
      arrange: withoutInterview,
      body: { status: 409, detail: INTERVIEW_PREP_REFUSALS.noInterview },
    },
    {
      case: 'neither requirements nor gaps are known',
      arrange: (fakes: Fakes) => {
        fakes.match.response = { match: null, job: null };
        fakes.repository.source = { ...INTERVIEW_PREP_SOURCE_ROW, aiParsed: null, stack: [] };
      },
      body: { status: 409, detail: INTERVIEW_PREP_REFUSALS.nothingToPrepare },
    },
    {
      case: 'the stored position is one the input refuses',
      arrange: ({ repository }: Fakes) => {
        repository.source = { ...INTERVIEW_PREP_SOURCE_ROW, position: '' };
      },
      body: { status: 422, errors: [{ path: 'position' }] },
    },
  ])('answers $body.status when $case and creates no job', async ({ arrange, body }) => {
    const fakes = await serviceWithFakes();
    arrange(fakes);

    await expect(fakes.generate()).rejects.toMatchObject({ body });
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it.each(MISSING_TARGETS)(
    'answers 404 to a read and a request and false to a suggestion for $case, storing nothing',
    async ({ userId, id }) => {
      const fakes = await serviceWithFakes();

      await expect(fakes.service.read(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
      await expect(fakes.generate(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
      await expect(fakes.suggest(userId, id)).resolves.toBe(false);
      expect(nothingStored(fakes)).toEqual([0, 0]);
    },
  );
});

describe('InterviewPrepService.suggest', () => {
  it('creates the job and writes the request without a request id in the given transaction', async () => {
    const fakes = await serviceWithFakes();

    await expect(fakes.suggest()).resolves.toBe(true);

    expect(fakes.ai.requested).toEqual([
      [
        OLENA_ID,
        {
          eventType: 'application.interview_prep_requested',
          requested: { applicationId: APPLICATION_ID, aiJobId: AI_JOB_ID, input: BUILT_VACANCY },
          tx: FAKE_TRANSACTION,
        },
      ],
    ]);
  });

  it('answers false and stores nothing with no planned interview', async () => {
    const fakes = await serviceWithFakes();
    withoutInterview(fakes);

    await expect(fakes.suggest()).resolves.toBe(false);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });
});
