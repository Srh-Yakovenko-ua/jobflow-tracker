import type { EvalReport } from './eval-cases.js';

export const MATCH_EVAL_LIMITS = { minRho: 0.7 } as const;

export type MatchCaseAnswer = { file: string; manualRank: number } & (
  { score: number | null } | { error: string }
);

const tsv = (cells: (string | number)[]) => cells.join('\t');

export function averageRanks(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length).fill(0);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (order[end + 1]?.value === order[start]?.value) {
      end += 1;
    }
    order.slice(start, end + 1).forEach(({ index }) => {
      ranks[index] = (start + end) / 2 + 1;
    });
    start = end + 1;
  }
  return ranks;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const deviations = (values: number[]) => {
  const center = mean(values);
  return values.map((value) => value - center);
};

const dot = (left: number[], right: number[]) =>
  left.map((value, index) => value * (right[index] ?? 0)).reduce((sum, value) => sum + value, 0);

function pearson(left: number[], right: number[]): number {
  const [dx, dy] = [deviations(left), deviations(right)];
  return dot(dx, dy) / Math.sqrt(dot(dx, dx) * dot(dy, dy));
}

const scoreOf = (answer: MatchCaseAnswer) => ('error' in answer ? 0 : (answer.score ?? 0));

function scoreCell(answer: MatchCaseAnswer): string {
  if ('error' in answer) {
    return `0 ${answer.error}`;
  }
  return answer.score === null ? '0 no_requirements' : String(answer.score);
}

export function matchReport(answers: MatchCaseAnswer[]): EvalReport {
  const manualRanks = averageRanks(answers.map(({ manualRank }) => manualRank));
  const scoreRanks = averageRanks(answers.map((answer) => -scoreOf(answer)));
  const rho = pearson(manualRanks, scoreRanks);
  const passed = rho > MATCH_EVAL_LIMITS.minRho;
  return {
    lines: [
      tsv(['case', 'manual_rank', 'score', 'score_rank']),
      ...answers.map((answer, index) =>
        tsv([answer.file, answer.manualRank, scoreCell(answer), scoreRanks[index] ?? '-']),
      ),
      '',
      tsv(['rho', Number.isNaN(rho) ? 'NaN' : rho.toFixed(3)]),
      tsv(['rho_min', MATCH_EVAL_LIMITS.minRho]),
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
