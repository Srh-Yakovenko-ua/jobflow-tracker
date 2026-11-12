import { vacancyParseFailure, type VacancyParseOutput } from '@jobflow/shared';

import type { EvalReport } from './eval-cases.js';
import type { VacancyExpected } from './vacancy-cases.js';

const THRESHOLD_NAMES = ['company', 'position', 'salary', 'stackF1'] as const;

type ThresholdName = (typeof THRESHOLD_NAMES)[number];

export const VACANCY_EVAL_THRESHOLDS: Record<ThresholdName, number> = {
  company: 0.9,
  position: 0.9,
  salary: 0.9,
  stackF1: 0.85,
};

export type VacancyCaseAnswer = { file: string; expected: VacancyExpected } & (
  { output: VacancyParseOutput } | { error: string }
);

export type VacancyEvalReport = EvalReport;

const ROWS = [
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

type Row = (typeof ROWS)[number];

type ScalarField = Exclude<Row, 'salary' | 'failure'>;

type Scored = Row | 'stack';

type Answered = Extract<VacancyCaseAnswer, { output: VacancyParseOutput }>;

type Verdict = { right: boolean; wrongExact: boolean; cells: string[] };

type StackTally = { truePositives: number; falsePositives: number; falseNegatives: number };

const SCORED: Scored[] = [...ROWS, 'stack'];

const NO_STACK: StackTally = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };

const WRONG: Verdict = { right: false, wrongExact: false, cells: [] };

const tsv = (cells: (string | number)[]) => cells.join('\t');

const fixed = (share: number) => share.toFixed(3);

const ratio = (part: number, whole: number) => (whole === 0 ? 1 : part / whole);

const foldedText = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const folded = (value: unknown) => (typeof value === 'string' ? foldedText(value) : value);

const shown = (value: unknown) => (Array.isArray(value) ? value.join(' | ') : String(value));

const joined = (sides: Verdict[], cell: number) => sides.map(({ cells }) => cells[cell]).join('/');

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

const itemsOf = (stack: string[]) => new Set(stack.map(foldedText));

function stackTally(answer: VacancyCaseAnswer): StackTally {
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

function verdictOf(answer: VacancyCaseAnswer, scored: Scored): Verdict {
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

function countOf(answers: VacancyCaseAnswer[], scored: Scored) {
  const verdicts = answers.map((answer) => verdictOf(answer, scored));
  return {
    correct: verdicts.filter(({ right }) => right).length,
    wrongExact: verdicts.filter(({ wrongExact }) => wrongExact).length,
  };
}

function stackScore(answers: VacancyCaseAnswer[]) {
  const sum = answers.map(stackTally).reduce(
    (total, tally) => ({
      truePositives: total.truePositives + tally.truePositives,
      falsePositives: total.falsePositives + tally.falsePositives,
      falseNegatives: total.falseNegatives + tally.falseNegatives,
    }),
    NO_STACK,
  );
  const found = sum.truePositives;
  return {
    precision: ratio(found, found + sum.falsePositives),
    recall: ratio(found, found + sum.falseNegatives),
    f1: ratio(2 * found, 2 * found + sum.falsePositives + sum.falseNegatives),
  };
}

function missLines(answer: VacancyCaseAnswer): string[] {
  if ('error' in answer) {
    return [tsv([answer.file, 'all', '-', answer.error, '-'])];
  }
  return SCORED.flatMap((scored) => {
    const { right, cells } = verdictOf(answer, scored);
    return right ? [] : [tsv([answer.file, scored, ...cells])];
  });
}

function fieldLines(answers: VacancyCaseAnswer[]): string[] {
  return ROWS.map((row) => {
    const { correct, wrongExact } = countOf(answers, row);
    return tsv([row, answers.length, correct, fixed(ratio(correct, answers.length)), wrongExact]);
  });
}

function stackLine(answers: VacancyCaseAnswer[]): string {
  const { precision, recall, f1 } = stackScore(answers);
  const { wrongExact } = countOf(answers, 'stack');
  return tsv(['stack', answers.length, fixed(precision), fixed(recall), fixed(f1), wrongExact]);
}

function actualOf(answers: VacancyCaseAnswer[]): Record<ThresholdName, number> {
  const accuracy = (row: Row) => ratio(countOf(answers, row).correct, answers.length);
  return {
    company: accuracy('company'),
    position: accuracy('position'),
    salary: accuracy('salary'),
    stackF1: stackScore(answers).f1,
  };
}

export function vacancyReport(answers: VacancyCaseAnswer[]): VacancyEvalReport {
  const actual = actualOf(answers);
  const met = (name: ThresholdName) => actual[name] >= VACANCY_EVAL_THRESHOLDS[name];
  const passed = THRESHOLD_NAMES.every(met);
  const thresholdLines = THRESHOLD_NAMES.map((name) =>
    tsv([name, VACANCY_EVAL_THRESHOLDS[name], fixed(actual[name]), met(name) ? 'PASS' : 'FAIL']),
  );
  return {
    lines: [
      tsv(['field', 'cases', 'correct', 'accuracy', 'wrong_exact']),
      ...fieldLines(answers),
      '',
      tsv(['field', 'cases', 'precision', 'recall', 'f1', 'wrong_exact']),
      stackLine(answers),
      '',
      tsv(['case', 'field', 'expected', 'got', 'confidence']),
      ...answers.flatMap(missLines),
      '',
      tsv(['threshold', 'minimum', 'actual', 'result']),
      ...thresholdLines,
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
