import { vacancyParseFailure, type VacancyParseOutput } from '@jobflow/shared';

import type { VacancyExpected } from './vacancy-cases.js';

export type VacancyCaseAnswer = { file: string; expected: VacancyExpected } & (
  { output: VacancyParseOutput } | { error: string }
);

export const ROWS = [
  'company',
  'position',
  'seniority',
  'salaryMin',
  'salaryMax',
  'salary',
  'currency',
  'salaryTax',
  'location',
  'workMode',
  'englishLevel',
  'sourceGuess',
  'failure',
] as const;

export type Row = (typeof ROWS)[number];

export type Scored = Row | 'stack';

export type StackTally = { truePositives: number; falsePositives: number; falseNegatives: number };

type ScalarField = Exclude<Row, 'salary' | 'failure'>;

type Answered = Extract<VacancyCaseAnswer, { output: VacancyParseOutput }>;

type Verdict = { right: boolean; wrongExact: boolean; cells: string[] };

export const SCORED: Scored[] = [...ROWS, 'stack'];

const WRONG: Verdict = { right: false, wrongExact: false, cells: [] };

const foldedText = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const folded = (value: unknown) => (typeof value === 'string' ? foldedText(value) : value);

const shown = (value: unknown) => (Array.isArray(value) ? value.join(' | ') : String(value));

const joined = (sides: Verdict[], cell: number) => sides.map(({ cells }) => cells[cell]).join('/');

const itemsOf = (stack: string[]) => new Set(stack.map(foldedText));

function fieldVerdict({ expected, output }: Answered, field: ScalarField): Verdict {
  const wanted = expected[field];
  const { value, confidence } = output[field];
  const accepted: unknown[] = Array.isArray(wanted) ? wanted : [wanted];
  const right = accepted.map(folded).includes(folded(value));
  const wrongExact = !right && confidence === 'exact';
  return { right, wrongExact, cells: [shown(wanted), shown(value), confidence] };
}

function salaryVerdict(answer: Answered): Verdict {
  const sides = [fieldVerdict(answer, 'salaryMin'), fieldVerdict(answer, 'salaryMax')];
  return {
    right: sides.every(({ right }) => right),
    wrongExact: sides.some(({ wrongExact }) => wrongExact),
    cells: [joined(sides, 0), joined(sides, 1), joined(sides, 2)],
  };
}

function failureVerdict({ expected, output }: Answered): Verdict {
  const got = vacancyParseFailure(output);
  return {
    right: got === expected.failure,
    wrongExact: false,
    cells: [shown(expected.failure), shown(got), '-'],
  };
}

export function stackTally(answer: VacancyCaseAnswer): StackTally {
  const expected = itemsOf(answer.expected.stack);
  const got = itemsOf('output' in answer ? answer.output.stack.value : []);
  const truePositives = [...got].filter((item) => expected.has(item)).length;
  return {
    truePositives,
    falsePositives: got.size - truePositives,
    falseNegatives: expected.size - truePositives,
  };
}

function stackVerdict(answer: Answered): Verdict {
  const { value, confidence } = answer.output.stack;
  const { falsePositives, falseNegatives } = stackTally(answer);
  const right = falsePositives + falseNegatives === 0;
  const wrongExact = !right && confidence === 'exact';
  return { right, wrongExact, cells: [shown(answer.expected.stack), shown(value), confidence] };
}

export function verdictOf(answer: VacancyCaseAnswer, scored: Scored): Verdict {
  if ('error' in answer) {
    return WRONG;
  }
  if (scored === 'salary') {
    return salaryVerdict(answer);
  }
  if (scored === 'failure') {
    return failureVerdict(answer);
  }
  return scored === 'stack' ? stackVerdict(answer) : fieldVerdict(answer, scored);
}
