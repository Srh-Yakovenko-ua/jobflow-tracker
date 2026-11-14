import {
  AI_PROMPT_VERSIONS,
  type AiKind,
  type MatchCoverage,
  type MatchOutput,
  type MonthlySummaryOutput,
  type ResumeParseOutput,
} from '@jobflow/shared';
import {
  buildMatchOutput,
  buildMonthlySummaryOutput,
  buildResumeParseOutput,
} from '@jobflow/shared/testing';

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

type MatchVariant = { coverage: Record<string, MatchCoverage>; explanation: string | null };

const DEMO_CALL = { model: 'demo', tokensIn: 0, tokensOut: 0, latencyMs: 0 } as const;

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

export const demoSummaryOutput = (): MonthlySummaryOutput => buildMonthlySummaryOutput();

export function demoCompletionOf(
  kind: AiKind,
  { inputHash, output }: Pick<DemoCompletion, 'inputHash' | 'output'>,
): DemoCompletion {
  return { kind, inputHash, output, promptVersion: AI_PROMPT_VERSIONS[kind], ...DEMO_CALL };
}
