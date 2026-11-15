import type {
  InterviewPrepInput,
  InterviewPrepOutput,
  InterviewPrepStep,
  InterviewPrepTopic,
} from '@jobflow/shared';

import type { EvalReport } from './eval-cases.js';

export type InterviewPrepCaseAnswer = {
  file: string;
  input: InterviewPrepInput;
  absent: string[];
} & ({ output: InterviewPrepOutput } | { error: string });

type Prepared = Extract<InterviewPrepCaseAnswer, { output: InterviewPrepOutput }>;

const tsv = (cells: (string | number)[]) => cells.join('\t');

const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const minutesOf = (steps: InterviewPrepStep[]) =>
  steps.reduce((total, { minutes }) => total + minutes, 0);

export function inputItemsOf({ requirements, gaps, weakSpots }: InterviewPrepInput): Set<string> {
  const items = [
    ...requirements,
    ...gaps.map(({ name }) => name),
    ...weakSpots.topics,
    ...weakSpots.reasons.map(({ code }) => code),
  ];
  return new Set(items.map(normalized));
}

function textsOf(output: InterviewPrepOutput): string[] {
  return [
    ...output.topics.flatMap(({ name, why, basis }) => [name, why, basis]),
    ...output.questions.flatMap(({ question, hint }) => [question, hint]),
    ...output.askCompany,
    ...[...output.plan30, ...output.plan120].map(({ task }) => task),
  ].map(normalized);
}

function faultsOf({ input, absent, output }: Prepared) {
  const items = inputItemsOf(input);
  const texts = textsOf(output);
  const terms = absent.map(normalized);
  return {
    untraced: output.topics.filter(({ basis }) => !items.has(normalized(basis))).length,
    absent: texts.filter((text) => terms.some((term) => text.includes(term))).length,
  };
}

function rowOf(answer: InterviewPrepCaseAnswer): string {
  if ('error' in answer) {
    return tsv([answer.file, ...Array.from({ length: 7 }, () => '-'), answer.error]);
  }
  const { untraced, absent } = faultsOf(answer);
  const { topics, questions, askCompany, plan30, plan120 } = answer.output;
  return tsv([
    answer.file,
    topics.length,
    untraced,
    questions.length,
    askCompany.length,
    minutesOf(plan30),
    minutesOf(plan120),
    absent,
    untraced + absent === 0 ? 'ok' : 'fail',
  ]);
}

const topicLine = ({ name, why, basis }: InterviewPrepTopic) => `- ${name}: ${why} [${basis}]`;

const preparedLines = ({ file, output }: Prepared) => [
  `## ${file}`,
  ...output.topics.map(topicLine),
  '',
];

export function interviewPrepReport(answers: InterviewPrepCaseAnswer[]): EvalReport {
  const rows = answers.map(rowOf);
  const passed = rows.every((row) => row.endsWith('\tok'));
  const prepared = answers.filter((answer): answer is Prepared => 'output' in answer);
  return {
    lines: [
      tsv([
        'case',
        'topics',
        'untraced_topics',
        'questions',
        'ask_company',
        'plan30_min',
        'plan120_min',
        'absent_named',
        'result',
      ]),
      ...rows,
      '',
      ...prepared.flatMap(preparedLines),
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
