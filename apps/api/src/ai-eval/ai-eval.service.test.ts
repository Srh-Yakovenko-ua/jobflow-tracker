import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchInputSchema } from '@jobflow/shared';
import {
  buildFollowupInput,
  buildMatchCompletion,
  buildMatchOutput,
} from '@jobflow/shared/testing';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { AiClient, AiServiceError } from '../modules/ai/index.js';
import { DocumentsClient, DocumentsError } from '../modules/resumes/index.js';
import {
  FakeAiClient,
  FOLLOWUP_COMPLETION,
  MATCH_COMPLETION,
  RESUME_COMPLETION,
  VACANCY_COMPLETION,
  VACANCY_EVAL_CASE,
  VACANCY_TEXT,
} from '../test/ai.js';
import { FakeDocumentsClient, RESUME_TEXT } from '../test/documents.js';
import { PDF, PDF_BYTES } from '../test/resumes.js';
import { NOW, settableClock } from '../test/time.js';
import { AiEvalService } from './ai-eval.service.js';

const TWO_CASES = {
  '01-djinni-en.json': VACANCY_EVAL_CASE,
  '02-dou-en.json': { ...VACANCY_EVAL_CASE, source: 'dou' },
};

const VACANCY_CALL = { kind: 'vacancy_parse', input: { text: VACANCY_TEXT } };

const INVALID_OUTPUT = new AiServiceError({ status: 422, type: 'ai_invalid_output' });

async function casesDir(cases: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'jobflow-ai-eval-'));
  await Promise.all(
    Object.entries(cases).map(([file, content]) =>
      writeFile(join(dir, file), content instanceof Uint8Array ? content : JSON.stringify(content)),
    ),
  );
  return dir;
}

type EvalFakes = { documents?: FakeDocumentsClient; clock?: ReturnType<typeof settableClock> };

async function evalService(
  ai: FakeAiClient,
  { documents = new FakeDocumentsClient(), clock = settableClock(NOW) }: EvalFakes = {},
): Promise<AiEvalService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiEvalService,
      { provide: AiClient, useValue: ai },
      { provide: DocumentsClient, useValue: documents },
      { provide: Clock, useValue: clock },
    ],
  }).compile();
  return moduleRef.get(AiEvalService);
}

async function runTwoCases(answer: FakeAiClient['answer']) {
  const ai = new FakeAiClient();
  ai.answer = answer;
  const report = await (await evalService(ai)).vacancy(await casesDir(TWO_CASES));
  return { ai, report };
}

describe('AiEvalService.vacancy', () => {
  it('sends each case text alone as the vacancy_parse payload, one call at a time, and scores them all', async () => {
    let inFlight = 0;
    let mostInFlight = 0;
    const { ai, report } = await runTwoCases(async () => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return VACANCY_COMPLETION;
    });

    expect(ai.calls).toEqual([VACANCY_CALL, VACANCY_CALL]);
    expect(mostInFlight).toBe(1);
    expect(report.lines).toContain('company\t2\t2\t1.000\t0');
    expect(report.passed).toBe(true);
  });

  it.for([
    { status: 503, type: 'not_ready' },
    { status: 504, type: 'ai_timeout' },
  ])(
    'stops at the first case on a $status $type from services/ai and fails the run',
    async (failure) => {
      const { ai, report } = await runTwoCases(() => Promise.reject(new AiServiceError(failure)));

      expect(ai.calls).toHaveLength(1);
      expect(report).toEqual({
        lines: [`stopped\t01-djinni-en.json\t${failure.type}`, 'FAIL'],
        passed: false,
      });
    },
  );

  it('counts a 422 ai_invalid_output as a wrong case and goes on to the next one', async () => {
    let answered = 0;
    const { ai, report } = await runTwoCases(() => {
      answered += 1;
      return answered === 1 ? Promise.reject(INVALID_OUTPUT) : Promise.resolve(VACANCY_COMPLETION);
    });

    expect(ai.calls).toHaveLength(2);
    expect(report.lines).toEqual(
      expect.arrayContaining([
        'company\t2\t1\t0.500\t0',
        '01-djinni-en.json\tall\t-\tai_invalid_output\t-',
      ]),
    );
    expect(report.passed).toBe(false);
  });

  it('refuses a malformed case file by its name before any call to services/ai', async () => {
    const ai = new FakeAiClient();
    const dir = await casesDir({
      '01-djinni-en.json': VACANCY_EVAL_CASE,
      '02-linkedin-en.json': { ...VACANCY_EVAL_CASE, source: 'linkedin' },
    });

    await expect((await evalService(ai)).vacancy(dir)).rejects.toThrow(
      'Eval case 02-linkedin-en.json is malformed',
    );
    expect(ai.calls).toEqual([]);
  });

  it('refuses a folder that holds no case file', async () => {
    const dir = await casesDir({});

    await expect((await evalService(new FakeAiClient())).vacancy(dir)).rejects.toThrow(
      `No eval cases in ${dir}`,
    );
  });
});

const MATCH_CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/match', import.meta.url));

const NOTHING_COVERED = buildMatchCompletion({
  output: buildMatchOutput({
    requirements: [{ name: 'Kotlin', weight: 'must', coverage: 'missing' }],
  }),
});

describe('AiEvalService.match', () => {
  it('sends each vacancy case with the sample CV as a match payload and ranks the scores from the scoring code', async () => {
    const ai = new FakeAiClient();
    ai.answer = () => {
      const sent = matchInputSchema.parse(ai.calls.at(-1)?.input);
      return Promise.resolve(
        sent.vacancy.stack.includes('React') ? MATCH_COMPLETION : NOTHING_COVERED,
      );
    };

    const report = await (await evalService(ai)).match(MATCH_CASES_DIR);

    expect(ai.calls).toHaveLength(15);
    expect(new Set(ai.calls.map(({ kind }) => kind))).toEqual(new Set(['match']));
    expect(report.lines).toEqual(
      expect.arrayContaining([
        '01-djinni-uk-react-net-no-currency.json\t2\t59\t1.5',
        '14-dou-en-fullstack-hybrid-kyiv.json\t1\t59\t1.5',
        '11-djinni-uk-flutter-junior.json\t15\t0\t9',
      ]),
    );
  });

  it('stops at the first case when services/ai is not ready', async () => {
    const ai = new FakeAiClient();
    ai.answer = () => Promise.reject(new AiServiceError({ status: 503, type: 'not_ready' }));

    expect(await (await evalService(ai)).match(MATCH_CASES_DIR)).toEqual({
      lines: ['stopped\t01-djinni-uk-react-net-no-currency.json\tnot_ready', 'FAIL'],
      passed: false,
    });
  });
});

const RESUME_EXPECTED = {
  skills: ['React', 'TypeScript'],
  seniority: 'middle',
  englishLevel: null,
};

const RESUME_CASES = {
  '01-cv.pdf': PDF_BYTES,
  '01-cv.expected.json': RESUME_EXPECTED,
  '02-cv.pdf': PDF_BYTES,
  '02-cv.expected.json': RESUME_EXPECTED,
};

function resumeRun(answer: FakeAiClient['answer']) {
  const ai = new FakeAiClient();
  const documents = new FakeDocumentsClient();
  const clock = settableClock(NOW);
  ai.answer = answer;
  const run = async (cases: Record<string, unknown> = RESUME_CASES) =>
    (await evalService(ai, { documents, clock })).resume(await casesDir(cases));
  return { ai, documents, clock, run };
}

describe('AiEvalService.resume', () => {
  it('extracts each case document, sends its text as resume_parse and times each case', async () => {
    const { ai, documents, clock, run } = resumeRun(() => {
      clock.at(new Date(clock.now().getTime() + 16_000));
      return Promise.resolve(RESUME_COMPLETION);
    });

    const report = await run();

    expect(documents.calls).toEqual([
      { bytes: PDF_BYTES, filename: '01-cv.pdf', mime: PDF },
      { bytes: PDF_BYTES, filename: '02-cv.pdf', mime: PDF },
    ]);
    expect(ai.calls).toEqual([
      { kind: 'resume_parse', input: { text: RESUME_TEXT, pages: [] } },
      { kind: 'resume_parse', input: { text: RESUME_TEXT, pages: [] } },
    ]);
    expect(report.lines.slice(1, 3)).toEqual([
      '01-cv.expected.json\t1.000\tmiddle/middle\tnull/upper_intermediate\t16000\tFAIL',
      '02-cv.expected.json\t1.000\tmiddle/middle\tnull/upper_intermediate\t16000\tFAIL',
    ]);
    expect(report.passed).toBe(false);
  });

  it('counts a document the service refuses as a wrong case and goes on to the next one', async () => {
    const { ai, documents, run } = resumeRun(() => Promise.resolve(RESUME_COMPLETION));
    let extracted = 0;
    const answer = documents.answer;
    documents.answer = () => {
      extracted += 1;
      return extracted === 1
        ? Promise.reject(new DocumentsError({ status: 422, type: 'encrypted_pdf' }))
        : answer();
    };

    const report = await run();

    expect(ai.calls).toHaveLength(1);
    expect(report.lines[1]).toBe(
      '01-cv.expected.json\t0.000\tencrypted_pdf\tencrypted_pdf\t0\tFAIL',
    );
  });

  it('stops at the first case when the document service times out', async () => {
    const { ai, documents, run } = resumeRun(() => Promise.resolve(RESUME_COMPLETION));
    documents.answer = () =>
      Promise.reject(new DocumentsError({ status: 504, type: 'documents_timeout' }));

    expect(await run()).toEqual({
      lines: ['stopped\t01-cv.expected.json\tdocuments_timeout', 'FAIL'],
      passed: false,
    });
    expect(ai.calls).toEqual([]);
  });

  it('refuses an expected file without its document beside it before any call', async () => {
    const { ai, documents, run } = resumeRun(() => Promise.resolve(RESUME_COMPLETION));

    await expect(run({ '01-cv.expected.json': RESUME_EXPECTED })).rejects.toThrow(
      'Eval case 01-cv.expected.json has no document beside it',
    );
    expect([documents.calls, ai.calls]).toEqual([[], []]);
  });
});

describe('AiEvalService.followup', () => {
  it('sends each case as the followup input and prints every draft with its word count', async () => {
    const ai = new FakeAiClient();
    ai.answer = () => Promise.resolve(FOLLOWUP_COMPLETION);
    const dir = await casesDir({ '01-uk.json': buildFollowupInput() });

    const report = await (await evalService(ai)).followup(dir);

    expect(ai.calls).toEqual([{ kind: 'followup', input: buildFollowupInput() }]);
    expect(report.lines.slice(0, 4)).toEqual([
      'case\twords\tinvented_numbers\tresult',
      '01-uk.json\t66\t-\tok',
      '',
      '## 01-uk.json',
    ]);
    expect(report.passed).toBe(true);
  });
});
