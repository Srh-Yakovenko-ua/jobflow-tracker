import { describe, expect, it } from 'vitest';

import { buildMatchOutput, buildResumeParseOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  MATCH_LIMITS,
  matchFailure,
  matchInputSchema,
  matchOutputSchema,
  matchProfileSchema,
} from './match.js';

const PROFILE = matchProfileSchema.parse(buildResumeParseOutput());

const VACANCY = { position: 'Senior React developer', stack: ['React', 'TypeScript'], text: '' };

const REQUIREMENT = { name: 'AWS', weight: 'must', coverage: 'missing' } as const;

const repeated = <Item>(count: number, item: Item) => Array.from({ length: count }, () => item);

describe('matchProfileSchema', () => {
  it('sends the model the skills with their years and the profile summary, without quotes, positions or companies', () => {
    expect(PROFILE).toEqual({
      skills: [
        { name: 'React', years: 0 },
        { name: 'TypeScript', years: 0 },
      ],
      totalYears: 0,
      seniority: 'middle',
      englishLevel: 'upper_intermediate',
      domains: ['fintech'],
      leadership: { hasExperience: false },
      languages: [{ name: 'English', level: 'B2' }],
    });
  });
});

describe('matchInputSchema', () => {
  it('keeps the designed limits: 15 requirements, 80-character names, a 240-character explanation', () => {
    expect(MATCH_LIMITS).toEqual({
      requirementsMax: 15,
      nameMaxLength: 80,
      explanationMaxLength: 240,
    });
  });

  it.for([
    { label: 'a manual application without vacancy text', vacancy: VACANCY },
    {
      label: 'a vacancy text of exactly 20 000 characters and a stack of 20 items',
      vacancy: { ...VACANCY, stack: repeated(20, 'React'), text: 'в'.repeat(20_000) },
    },
  ])('accepts $label', ({ vacancy }) => {
    const input = { vacancy, profile: PROFILE };
    expect(matchInputSchema.parse(input)).toEqual(input);
  });

  it.for([
    { label: 'a blank vacancy text', patch: { text: ' \n' }, path: 'vacancy.text' },
    {
      label: 'a 20 001-character vacancy text',
      patch: { text: 'в'.repeat(20_001) },
      path: 'vacancy.text',
    },
    { label: 'an empty position', patch: { position: '' }, path: 'vacancy.position' },
    {
      label: 'a stack of 21 items',
      patch: { stack: repeated(21, 'React') },
      path: 'vacancy.stack',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = matchInputSchema.safeParse({
      vacancy: { ...VACANCY, ...patch },
      profile: PROFILE,
    });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('matchOutputSchema', () => {
  it('accepts weighted requirements mapped to the profile and a one-sentence explanation', () => {
    const output = buildMatchOutput();
    expect(matchOutputSchema.parse(output)).toEqual(output);
  });

  it('accepts exactly 15 requirements with 80-character names and a 240-character explanation', () => {
    const output = buildMatchOutput({
      requirements: repeated(15, { ...REQUIREMENT, name: 'н'.repeat(80) }),
      explanation: 'н'.repeat(240),
    });
    expect(matchOutputSchema.parse(output)).toEqual(output);
  });

  it.for([
    {
      label: 'a 16th requirement',
      patch: { requirements: repeated(16, REQUIREMENT) },
      path: 'requirements',
    },
    {
      label: 'an 81-character requirement name',
      patch: { requirements: [{ ...REQUIREMENT, name: 'н'.repeat(81) }] },
      path: 'requirements.0.name',
    },
    {
      label: 'an unknown weight',
      patch: { requirements: [{ ...REQUIREMENT, weight: 'required' }] },
      path: 'requirements.0.weight',
    },
    {
      label: 'an unknown coverage',
      patch: { requirements: [{ ...REQUIREMENT, coverage: 'some' }] },
      path: 'requirements.0.coverage',
    },
    { label: 'an empty explanation', patch: { explanation: '' }, path: 'explanation' },
    {
      label: 'a 241-character explanation',
      patch: { explanation: 'н'.repeat(241) },
      path: 'explanation',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = matchOutputSchema.safeParse({ ...buildMatchOutput(), ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('matchFailure', () => {
  it.for([
    { label: 'the model finds no requirement', requirements: [] },
    {
      label: 'every requirement is only mentioned',
      requirements: [{ ...REQUIREMENT, weight: 'mentioned' as const }],
    },
  ])('names no_requirements when $label', ({ requirements }) => {
    expect(matchFailure(buildMatchOutput({ requirements }))).toBe('no_requirements');
  });

  it.for([
    { label: 'a must have', weight: 'must' as const },
    { label: 'only a nice to have', weight: 'nice' as const },
  ])('names no failure when the vacancy has $label', ({ weight }) => {
    expect(
      matchFailure(buildMatchOutput({ requirements: [{ ...REQUIREMENT, weight }] })),
    ).toBeNull();
  });
});
