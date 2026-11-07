import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AiClient, AiServiceError } from '../modules/ai/index.js';
import { FakeAiClient, VACANCY_COMPLETION, VACANCY_EVAL_CASE, VACANCY_TEXT } from '../test/ai.js';
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
      writeFile(join(dir, file), JSON.stringify(content)),
    ),
  );
  return dir;
}

async function evalService(ai: FakeAiClient): Promise<AiEvalService> {
  const moduleRef = await Test.createTestingModule({
    providers: [AiEvalService, { provide: AiClient, useValue: ai }],
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
