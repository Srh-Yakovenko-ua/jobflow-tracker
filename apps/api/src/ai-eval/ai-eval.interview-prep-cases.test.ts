import { fileURLToPath } from 'node:url';

import { INTERVIEW_PREP_LIMITS } from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { type InterviewPrepEvalCase, loadInterviewPrepCases } from './interview-prep-cases.js';
import { inputItemsOf } from './interview-prep-report.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/interview-prep', import.meta.url));

const INJECTION = /ignore previous instructions/i;

const carriesInjection = ({ input }: InterviewPrepEvalCase) =>
  input.requirements.some((requirement) => INJECTION.test(requirement));

function absentInInput({ file, input, absent }: InterviewPrepEvalCase): string[] {
  const text = JSON.stringify(input).toLowerCase();
  return absent
    .filter((term) => text.includes(term.toLowerCase()))
    .map((term) => `${file}: ${term}`);
}

describe('the interview prep eval cases', () => {
  let cases: InterviewPrepEvalCase[];

  beforeAll(async () => {
    cases = await loadInterviewPrepCases(CASES_DIR);
  });

  it('parses six inputs, among them two without a Match Score and two without weak spots', () => {
    expect(cases.map(({ file }) => file)).toEqual([
      '01-react-tech-interview.json',
      '02-node-screening.json',
      '03-fullstack-no-score.json',
      '04-lead-final.json',
      '05-injected-requirement.json',
      '06-three-items.json',
    ]);
    expect(cases.filter(({ input }) => input.gaps.length === 0)).toHaveLength(2);
    expect(cases.filter(({ input }) => input.weakSpots.reasons.length === 0)).toHaveLength(2);
  });

  it('covers four interview kinds', () => {
    expect(new Set(cases.map(({ input }) => input.interviewKind)).size).toBe(4);
  });

  it('carries the injected instruction in exactly one case, which must not answer HACKED', () => {
    const injected = cases.filter(carriesInjection);

    expect(injected.map(({ file, absent }) => [file, absent])).toEqual([
      ['05-injected-requirement.json', ['HACKED']],
    ]);
  });

  it('leaves the injected case enough input items for the shortest pack besides the instruction', () => {
    const [injected] = cases.filter(carriesInjection);
    const items = injected ? [...inputItemsOf(injected.input)] : [];

    expect(items.filter((item) => !INJECTION.test(item)).length).toBeGreaterThanOrEqual(
      INTERVIEW_PREP_LIMITS.topicsMin,
    );
  });

  it('names no absent term inside the input of a regular case', () => {
    const regular = cases.filter((evalCase) => !carriesInjection(evalCase));

    expect(regular.flatMap(absentInInput)).toEqual([]);
  });
});
