import type { EvalReport } from './eval-cases.js';
import {
  type Row,
  ROWS,
  SCORED,
  type Scored,
  type StackTally,
  stackTally,
  type VacancyCaseAnswer,
  verdictOf,
} from './vacancy-verdicts.js';

const THRESHOLD_NAMES = ['company', 'position', 'salary', 'location', 'stackF1'] as const;

type ThresholdName = (typeof THRESHOLD_NAMES)[number];

export const VACANCY_EVAL_THRESHOLDS: Record<ThresholdName, number> = {
  company: 0.9,
  position: 0.9,
  salary: 0.9,
  location: 0.8,
  stackF1: 0.85,
};

export type VacancyEvalReport = EvalReport;

const NO_STACK: StackTally = { truePositives: 0, falsePositives: 0, falseNegatives: 0 };

const tsv = (cells: (string | number)[]) => cells.join('\t');

const fixed = (share: number) => share.toFixed(3);

const ratio = (part: number, whole: number) => (whole === 0 ? 1 : part / whole);

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
    location: accuracy('location'),
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
