import { describe, expect, it } from 'vitest';

import { buildResumeParseOutput, CV_HINTS_INPUT, CV_HINTS_OUTPUT } from '../../testing/index.js';
import { keysDeep, PRIVATE_PAYLOAD_KEYS } from '../test/private-payload-keys.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  CV_HINTS_LIMITS,
  cvHintsInputSchema,
  cvHintsOutputSchema,
  cvHintsProfileSchema,
} from './cv-hints.js';

const REQUIREMENT = CV_HINTS_INPUT.requirements[0];

const HINT = CV_HINTS_OUTPUT.hints[0];

const repeated = <Item>(count: number, item: Item) => Array.from({ length: count }, () => item);

describe('cvHintsProfileSchema', () => {
  it('sends the model the skills with their quotes and the position titles with dates, without companies or languages', () => {
    expect(cvHintsProfileSchema.parse(buildResumeParseOutput())).toEqual({
      skills: [
        { name: 'React', years: 0, evidence: 'Built the Acme dashboard in React' },
        { name: 'TypeScript', years: 0, evidence: null },
      ],
      positions: [
        { title: 'Frontend developer', start: '2021-03', end: null },
        { title: 'Junior developer', start: '2019-09', end: '2021-02' },
      ],
      totalYears: 0,
      seniority: 'middle',
      englishLevel: 'upper_intermediate',
      domains: ['fintech'],
      leadership: { hasExperience: false, evidence: null },
    });
  });
});

describe('cvHintsInputSchema', () => {
  it('keeps the designed limits: 5 hints with a 240-character suggestion', () => {
    expect(CV_HINTS_LIMITS).toEqual({ hintsMax: 5, suggestionMaxLength: 240 });
  });

  it('names no input field the AI-04 guard refuses', () => {
    expect(keysDeep(CV_HINTS_INPUT).filter((key) => PRIVATE_PAYLOAD_KEYS.includes(key))).toEqual(
      [],
    );
  });

  it.for([
    { label: 'the weighed requirements of the match breakdown', patch: {} },
    { label: 'exactly 15 requirements', patch: { requirements: repeated(15, REQUIREMENT) } },
    { label: 'a score of 0', patch: { score: 0 } },
  ])('accepts $label', ({ patch }) => {
    const input = { ...CV_HINTS_INPUT, ...patch };
    expect(cvHintsInputSchema.parse(input)).toEqual(input);
  });

  it.for([
    { label: 'an empty position', patch: { position: '' }, path: 'position' },
    { label: 'a score above 100', patch: { score: 101 }, path: 'score' },
    { label: 'a fractional score', patch: { score: 59.5 }, path: 'score' },
    {
      label: 'a 16th requirement',
      patch: { requirements: repeated(16, REQUIREMENT) },
      path: 'requirements',
    },
    {
      label: 'a requirement that is only mentioned',
      patch: { requirements: [{ ...REQUIREMENT, weight: 'mentioned' }] },
      path: 'requirements.0.weight',
    },
    {
      label: 'a requirement without its coverage',
      patch: { requirements: [{ ...REQUIREMENT, coverage: undefined }] },
      path: 'requirements.0.coverage',
    },
    {
      label: 'negative points lost',
      patch: { requirements: [{ ...REQUIREMENT, pointsLost: -1 }] },
      path: 'requirements.0.pointsLost',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = cvHintsInputSchema.safeParse({ ...CV_HINTS_INPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('cvHintsOutputSchema', () => {
  it('accepts a hint grounded in a CV line and the gaps wording cannot close', () => {
    expect(cvHintsOutputSchema.parse(CV_HINTS_OUTPUT)).toEqual(CV_HINTS_OUTPUT);
  });

  it('accepts exactly 5 hints with 240-character suggestions, no gaps', () => {
    const output = { hints: repeated(5, { ...HINT, suggestion: 'п'.repeat(240) }), gaps: [] };
    expect(cvHintsOutputSchema.parse(output)).toEqual(output);
  });

  it.for([
    { label: 'a 6th hint', patch: { hints: repeated(6, HINT) }, path: 'hints' },
    {
      label: 'a 241-character suggestion',
      patch: { hints: [{ ...HINT, suggestion: 'п'.repeat(241) }] },
      path: 'hints.0.suggestion',
    },
    {
      label: 'an empty suggestion',
      patch: { hints: [{ ...HINT, suggestion: '' }] },
      path: 'hints.0.suggestion',
    },
    {
      label: 'an empty evidence quote',
      patch: { hints: [{ ...HINT, evidenceInCv: '' }] },
      path: 'hints.0.evidenceInCv',
    },
    {
      label: 'a 121-character evidence quote',
      patch: { hints: [{ ...HINT, evidenceInCv: 'е'.repeat(121) }] },
      path: 'hints.0.evidenceInCv',
    },
    {
      label: 'an 81-character requirement name',
      patch: { hints: [{ ...HINT, requirement: 'н'.repeat(81) }] },
      path: 'hints.0.requirement',
    },
    {
      label: 'a score impact above 100',
      patch: { hints: [{ ...HINT, expectedScoreImpact: 101 }] },
      path: 'hints.0.expectedScoreImpact',
    },
    {
      label: 'a fractional score impact',
      patch: { hints: [{ ...HINT, expectedScoreImpact: 4.5 }] },
      path: 'hints.0.expectedScoreImpact',
    },
    { label: 'a 16th gap', patch: { gaps: repeated(16, 'AWS') }, path: 'gaps' },
    { label: 'an empty gap name', patch: { gaps: [''] }, path: 'gaps.0' },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = cvHintsOutputSchema.safeParse({ ...CV_HINTS_OUTPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});
