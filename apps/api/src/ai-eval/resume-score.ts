import type { ResumeParseOutput } from '@jobflow/shared';

import type { EvalReport } from './eval-cases.js';
import type { ResumeExpected } from './resume-cases.js';

export const RESUME_EVAL_LIMITS = { caseMs: 15_000 } as const;

export type ResumeCaseAnswer = { file: string; expected: ResumeExpected; ms: number } & (
  { output: ResumeParseOutput } | { error: string }
);

type CaseRow = { recall: number; passed: boolean; cells: (string | number)[] };

const tsv = (cells: (string | number)[]) => cells.join('\t');

const folded = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const pair = (expected: string | null, got: string | null) => `${String(expected)}/${String(got)}`;

function skillRecall({ expected, output }: Extract<ResumeCaseAnswer, { output: unknown }>) {
  const found = new Set(output.skills.map(({ name }) => folded(name)));
  return (
    expected.skills.filter((skill) => found.has(folded(skill))).length / expected.skills.length
  );
}

function caseRow(answer: ResumeCaseAnswer): CaseRow {
  const { file, expected, ms } = answer;
  const inTime = ms <= RESUME_EVAL_LIMITS.caseMs;
  if ('error' in answer) {
    return {
      recall: 0,
      passed: false,
      cells: [file, '0.000', answer.error, answer.error, ms, 'FAIL'],
    };
  }
  const recall = skillRecall(answer);
  const { seniority, englishLevel } = answer.output;
  return {
    recall,
    passed: inTime,
    cells: [
      file,
      recall.toFixed(3),
      pair(expected.seniority, seniority),
      pair(expected.englishLevel, englishLevel),
      ms,
      inTime ? 'PASS' : 'FAIL',
    ],
  };
}

export function resumeReport(answers: ResumeCaseAnswer[]): EvalReport {
  const rows = answers.map(caseRow);
  const passed = rows.every((row) => row.passed);
  const meanRecall = rows.reduce((sum, { recall }) => sum + recall, 0) / rows.length;
  return {
    lines: [
      tsv(['case', 'skills_recall', 'seniority', 'english', 'ms', 'result']),
      ...rows.map(({ cells }) => tsv(cells)),
      '',
      tsv(['skills_recall_mean', meanRecall.toFixed(3)]),
      tsv(['case_ms_limit', RESUME_EVAL_LIMITS.caseMs]),
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
