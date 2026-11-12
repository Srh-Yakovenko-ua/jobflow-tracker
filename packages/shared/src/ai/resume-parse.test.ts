import { describe, expect, it } from 'vitest';

import { buildResumeParseOutput } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  RESUME_PARSE_LIMITS,
  resumeParseInputSchema,
  resumeParseOutputSchema,
} from './resume-parse.js';

const JPEG_PAGE = '/9j/4AAQSkZJRg==';

const PARSED = buildResumeParseOutput();

const OPEN_POSITION = {
  title: 'Backend developer',
  company: 'Globex',
  start: '2018-01',
  end: null,
};

const NODE_SKILL = { name: 'Node.js', years: 3, evidence: null, positions: [0] };

const repeated = <Item>(count: number, item: Item) => Array.from({ length: count }, () => item);

describe('resumeParseInputSchema', () => {
  it('keeps the designed limits: 40 000 characters of text, 25 skills, 10 positions, 120-character evidence', () => {
    expect(RESUME_PARSE_LIMITS).toEqual({
      textMaxLength: 40_000,
      skillsMax: 25,
      positionsMax: 10,
      evidenceMaxLength: 120,
      listMax: 10,
      nameMaxLength: 120,
      levelMaxLength: 20,
      yearsMax: 60,
    });
  });

  it.for([
    { label: 'a text resume without pages', input: { text: 'в'.repeat(40_000), pages: [] } },
    {
      label: 'a scan with three pages and no text',
      input: { text: '', pages: repeated(3, JPEG_PAGE) },
    },
  ])('accepts $label', ({ input }) => {
    expect(resumeParseInputSchema.parse(input)).toEqual(input);
  });

  it.for([
    {
      label: 'a 40 001-character text',
      input: { text: 'в'.repeat(40_001), pages: [] },
      path: 'text',
    },
    {
      label: 'a text with a NUL character',
      input: { text: 'React\u0000', pages: [] },
      path: 'text',
    },
    {
      label: 'a fourth scan page',
      input: { text: '', pages: repeated(4, JPEG_PAGE) },
      path: 'pages',
    },
    { label: 'an empty scan page', input: { text: '', pages: [''] }, path: 'pages.0' },
    { label: 'a missing pages list', input: { text: 'React' }, path: 'pages' },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(resumeParseInputSchema.safeParse(input))).toEqual([path]);
  });
});

describe('resumeParseOutputSchema', () => {
  it('accepts a profile with positions, skills tied to them, languages and leadership', () => {
    expect(resumeParseOutputSchema.parse(PARSED)).toEqual(PARSED);
  });

  it('accepts a profile at every list limit', () => {
    const atLimits = buildResumeParseOutput({
      positions: repeated(10, OPEN_POSITION),
      skills: repeated(25, {
        ...NODE_SKILL,
        years: 60,
        evidence: 'в'.repeat(120),
        positions: [9],
      }),
      totalYears: 60,
      domains: repeated(10, 'fintech'),
      languages: repeated(10, { name: 'English', level: 'в'.repeat(20) }),
    });
    expect(resumeParseOutputSchema.parse(atLimits)).toEqual(atLimits);
  });

  it.for([
    {
      label: 'an eleventh position',
      patch: { positions: repeated(11, OPEN_POSITION) },
      path: 'positions',
    },
    { label: 'a 26th skill', patch: { skills: repeated(26, NODE_SKILL) }, path: 'skills' },
    {
      label: 'a start month 13',
      patch: { positions: [{ ...OPEN_POSITION, start: '2021-13' }] },
      path: 'positions.0.start',
    },
    {
      label: 'an end given as a full date',
      patch: { positions: [{ ...OPEN_POSITION, end: '2021-03-01' }] },
      path: 'positions.0.end',
    },
    {
      label: 'a skill of 61 years',
      patch: { skills: [{ ...NODE_SKILL, years: 61 }] },
      path: 'skills.0.years',
    },
    {
      label: 'a skill evidence of 121 characters',
      patch: { skills: [{ ...NODE_SKILL, evidence: 'в'.repeat(121) }] },
      path: 'skills.0.evidence',
    },
    {
      label: 'a skill tied to a position past the tenth',
      patch: { skills: [{ ...NODE_SKILL, positions: [10] }] },
      path: 'skills.0.positions.0',
    },
    { label: 'negative total years', patch: { totalYears: -1 }, path: 'totalYears' },
    { label: 'an unknown seniority', patch: { seniority: 'principal' }, path: 'seniority' },
    { label: 'an eleventh domain', patch: { domains: repeated(11, 'fintech') }, path: 'domains' },
    {
      label: 'a leadership evidence of 121 characters',
      patch: { leadership: { hasExperience: true, evidence: 'в'.repeat(121) } },
      path: 'leadership.evidence',
    },
    {
      label: 'a language level of 21 characters',
      patch: { languages: [{ name: 'English', level: 'в'.repeat(21) }] },
      path: 'languages.0.level',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = resumeParseOutputSchema.safeParse({ ...PARSED, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});
