import {
  AI_PROMPT_VERSIONS,
  type AiKind,
  APPLICATION_FORMS_UK,
  countedUk,
  type MatchCoverage,
  type MatchOutput,
  type MonthlySummaryInput,
  type MonthlySummaryOutput,
  monthlySummaryOutputSchema,
  type ResumeParseOutput,
  type YearMonth,
} from '@jobflow/shared';
import {
  buildMatchOutput,
  buildMonthlySummaryOutput,
  buildResumeParseOutput,
} from '@jobflow/shared/testing';

import { monthNameOf, shiftMonth } from '../common/year-month.js';
import { scoreMatch } from '../modules/match/index.js';

export type DemoCompletion = {
  kind: AiKind;
  inputHash: string;
  output: MatchOutput | MonthlySummaryOutput;
  promptVersion: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
};

export type DemoMatch = { output: MatchOutput; score: number };

export type DemoSummaryInput = {
  month: YearMonth;
  sent: Pick<MonthlySummaryInput['activity']['sent'], 'month' | 'previousMonth'>;
};

type MatchVariant = { coverage: Record<string, MatchCoverage>; explanation: string | null };

type SummaryAction = MonthlySummaryOutput['actions'][number];

const DEMO_CALL = { model: 'demo', tokensIn: 0, tokensOut: 0, latencyMs: 0 } as const;

const RESUME_AB = {
  storySentence:
    'Конверсія у скринінг з CV v2 44%, з CV v1 56%, але відповідей поки замало для висновку.',
  designActionTitle: 'Відгукуватися лише з CV v2',
  storyAction: {
    title: 'Ще кілька відгуків з CV v2 перед вибором версії',
    why: 'З CV v2 конверсія у скринінг 44%, з CV v1 56%, але відповідей поки замало для висновку.',
    expectedEffect: 'Ще 1 відгук, і порівняння версій CV дасть перший висновок.',
    metric: 'Конверсія у скринінг за версією CV',
  },
} as const;

const DEMO_SUMMARY_SENTENCES = [
  'До скринінгу дійшло 17 з 40 відгуків, це 43%.',
  RESUME_AB.storySentence,
  "Найдорожчий етап техінтерв'ю: з 9 пройдено 4, і в 3 з 4 відмов там причина одна: «не вистачає скілів».",
  "Далі об'єм відгуків уже не допоможе: воронка звужується не на вході.",
] as const;

const STORY_ACTIONS: Record<string, Partial<SummaryAction>> = {
  [RESUME_AB.designActionTitle]: RESUME_AB.storyAction,
  "Два тижні алгоритмів перед техінтерв'ю": {
    expectedEffect:
      "Якщо конверсія техінтерв'ю дійде до 60%, прогноз офера на дашборді стане коротшим.",
  },
};

const MATCH_VARIANTS: readonly MatchVariant[] = [
  { coverage: {}, explanation: null },
  {
    coverage: { GraphQL: 'full', 'AWS / інфраструктура': 'partial' },
    explanation: 'Стек і GraphQL збігаються, AWS частково, бракує досвіду ліда.',
  },
  {
    coverage: { 'Node.js у проді': 'partial', GraphQL: 'missing' },
    explanation: 'React збігається, Node.js слабкий, бракує GraphQL і AWS.',
  },
];

const PROFILE_OVERRIDES: Record<number, Partial<ResumeParseOutput>> = {
  2: { domains: ['fintech', 'e-commerce'] },
  3: { domains: ['design systems', 'e-commerce'] },
};

function matchOf({ coverage, explanation }: MatchVariant): DemoMatch {
  const base = buildMatchOutput();
  const output = buildMatchOutput({
    requirements: base.requirements.map((requirement) => ({
      ...requirement,
      coverage: coverage[requirement.name] ?? requirement.coverage,
    })),
    explanation: explanation ?? base.explanation,
  });
  const breakdown = scoreMatch(output);
  if (breakdown === null) {
    throw new Error('A demo match variant has no weighed requirement');
  }
  return { output, score: breakdown.score };
}

const DEMO_MATCHES = MATCH_VARIANTS.map(matchOf);

export function demoMatchOf(index: number): DemoMatch {
  const match = DEMO_MATCHES[index % DEMO_MATCHES.length];
  if (match === undefined) {
    throw new Error('No demo match variant');
  }
  return match;
}

export const demoResumeProfileOf = (number: number): ResumeParseOutput =>
  buildResumeParseOutput(PROFILE_OVERRIDES[number]);

function changeOf(difference: number): string {
  if (difference === 0) {
    return 'стільки ж, скільки';
  }
  const direction = difference > 0 ? 'більше' : 'менше';
  return `на ${String(Math.abs(difference))} ${direction}, ніж`;
}

function sentSentenceOf({ month, sent }: DemoSummaryInput): string {
  const count = countedUk(sent.month, APPLICATION_FORMS_UK);
  const change = changeOf(sent.month - sent.previousMonth);
  const previousName = monthNameOf(shiftMonth(month, -1));
  return `За ${monthNameOf(month)}: ${count}, ${change} за ${previousName}.`;
}

export function demoSummaryOutput(input: DemoSummaryInput): MonthlySummaryOutput {
  const { actions } = buildMonthlySummaryOutput();
  return monthlySummaryOutputSchema.parse({
    summary: [sentSentenceOf(input), ...DEMO_SUMMARY_SENTENCES].join(' '),
    actions: actions.map((action) => ({ ...action, ...STORY_ACTIONS[action.title] })),
  });
}

export function demoCompletionOf(
  kind: AiKind,
  { inputHash, output }: Pick<DemoCompletion, 'inputHash' | 'output'>,
): DemoCompletion {
  return { kind, inputHash, output, promptVersion: AI_PROMPT_VERSIONS[kind], ...DEMO_CALL };
}
