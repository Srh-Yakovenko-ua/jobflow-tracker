import { FOLLOWUP_LIMITS, type FollowupInput, type FollowupOutput } from '@jobflow/shared';

import type { EvalReport } from './eval-cases.js';

export type FollowupCaseAnswer = { file: string; input: FollowupInput } & (
  { output: FollowupOutput } | { error: string }
);

type Drafted = Extract<FollowupCaseAnswer, { output: FollowupOutput }>;

const WORD = /[\p{L}\p{N}]/u;

const NUMBER = /\d+/g;

const tsv = (cells: (string | number)[]) => cells.join('\t');

const wordCountOf = (text: string) => text.split(/\s+/).filter((token) => WORD.test(token)).length;

const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map(Number);

function inventedNumbers({ input, output }: Drafted): number[] {
  const given = new Set(numbersIn(JSON.stringify(input)));
  return numbersIn(`${output.subject}\n${output.body}`).filter((value) => !given.has(value));
}

function verdictOf(words: number, invented: number[]): string {
  if (words < FOLLOWUP_LIMITS.wordsMin || words > FOLLOWUP_LIMITS.wordsMax) {
    return 'words';
  }
  return invented.length > 0 ? 'numbers' : 'ok';
}

function rowOf(answer: FollowupCaseAnswer): string {
  if ('error' in answer) {
    return tsv([answer.file, '-', '-', answer.error]);
  }
  const words = wordCountOf(answer.output.body);
  const invented = inventedNumbers(answer);
  return tsv([answer.file, words, invented.join(' ') || '-', verdictOf(words, invented)]);
}

const draftLines = ({ file, output }: Drafted) => [`## ${file}`, output.subject, output.body, ''];

export function followupReport(answers: FollowupCaseAnswer[]): EvalReport {
  const rows = answers.map(rowOf);
  const passed = rows.every((row) => row.endsWith('\tok'));
  const drafted = answers.filter((answer): answer is Drafted => 'output' in answer);
  return {
    lines: [
      tsv(['case', 'words', 'invented_numbers', 'result']),
      ...rows,
      '',
      ...drafted.flatMap(draftLines),
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
