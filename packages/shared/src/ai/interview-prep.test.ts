import { describe, expect, it } from 'vitest';

import { INTERVIEW_PREP_INPUT, INTERVIEW_PREP_OUTPUT } from '../../testing/index.js';
import { keysDeep, PRIVATE_PAYLOAD_KEYS } from '../test/private-payload-keys.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { interviewPrepInputSchema, interviewPrepOutputSchema } from './interview-prep.js';

const GAP = INTERVIEW_PREP_INPUT.gaps[0];

const REASON = INTERVIEW_PREP_INPUT.weakSpots.reasons[0];

const TOPIC = INTERVIEW_PREP_OUTPUT.topics[0];

const QUESTION = INTERVIEW_PREP_OUTPUT.questions[0];

const STEP = { minutes: 15, task: 'Пройди дві задачі на масиви вголос.' };

const repeated = <Item>(count: number, item: Item) => Array.from({ length: count }, () => item);

const weakSpots = (patch: object) => ({ ...INTERVIEW_PREP_INPUT.weakSpots, ...patch });

describe('interviewPrepInputSchema', () => {
  it('names no input field the AI-04 guard refuses', () => {
    expect(
      keysDeep(INTERVIEW_PREP_INPUT).filter((key) => PRIVATE_PAYLOAD_KEYS.includes(key)),
    ).toEqual([]);
  });

  it.for([
    { label: 'the parsed requirements, the gaps and the weak spot codes', patch: {} },
    { label: 'exactly 16 requirements', patch: { requirements: repeated(16, 'GraphQL') } },
    { label: 'no requirements and no gaps', patch: { requirements: [], gaps: [] } },
    { label: 'no weak spots', patch: { weakSpots: { reasons: [], topics: [] } } },
    {
      label: '5 reasons and 8 topics',
      patch: { weakSpots: { reasons: repeated(5, REASON), topics: repeated(8, 'algorithms') } },
    },
  ])('accepts $label', ({ patch }) => {
    const input = { ...INTERVIEW_PREP_INPUT, ...patch };
    expect(interviewPrepInputSchema.parse(input)).toEqual(input);
  });

  it.for([
    { label: 'an unknown interview kind', patch: { interviewKind: 'chat' }, path: 'interviewKind' },
    {
      label: 'a 17th requirement',
      patch: { requirements: repeated(17, 'GraphQL') },
      path: 'requirements',
    },
    {
      label: 'a 201-character requirement',
      patch: { requirements: ['в'.repeat(201)] },
      path: 'requirements.0',
    },
    { label: 'a 16th gap', patch: { gaps: repeated(16, GAP) }, path: 'gaps' },
    {
      label: 'a gap the CV fully covers',
      patch: { gaps: [{ ...GAP, coverage: 'full' }] },
      path: 'gaps.0.coverage',
    },
    {
      label: 'a 6th reason',
      patch: { weakSpots: weakSpots({ reasons: repeated(6, REASON) }) },
      path: 'weakSpots.reasons',
    },
    {
      label: 'a reason code outside the taxonomy',
      patch: { weakSpots: weakSpots({ reasons: [{ ...REASON, code: 'bad_vibes' }] }) },
      path: 'weakSpots.reasons.0.code',
    },
    {
      label: 'a reason counted zero times',
      patch: { weakSpots: weakSpots({ reasons: [{ ...REASON, count: 0 }] }) },
      path: 'weakSpots.reasons.0.count',
    },
    {
      label: 'a 9th topic',
      patch: { weakSpots: weakSpots({ topics: repeated(9, 'algorithms') }) },
      path: 'weakSpots.topics',
    },
    {
      label: 'a topic carrying free note text',
      patch: { weakSpots: weakSpots({ topics: ['завалив live coding на дереві'] }) },
      path: 'weakSpots.topics.0',
    },
    {
      label: 'a 41-character topic code',
      patch: { weakSpots: weakSpots({ topics: ['a'.repeat(41)] }) },
      path: 'weakSpots.topics.0',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = interviewPrepInputSchema.safeParse({ ...INTERVIEW_PREP_INPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('interviewPrepOutputSchema', () => {
  it('accepts 5 ranked topics with their basis, 10 questions, 3 questions to the company and both plans', () => {
    expect(interviewPrepOutputSchema.parse(INTERVIEW_PREP_OUTPUT)).toEqual(INTERVIEW_PREP_OUTPUT);
  });

  it.for([
    { label: '8 topics', patch: { topics: repeated(8, TOPIC) } },
    { label: 'a 30-minute plan in one step', patch: { plan30: [{ ...STEP, minutes: 30 }] } },
    { label: 'a 2-hour plan in one step', patch: { plan120: [{ ...STEP, minutes: 120 }] } },
  ])('accepts $label', ({ patch }) => {
    const output = { ...INTERVIEW_PREP_OUTPUT, ...patch };
    expect(interviewPrepOutputSchema.parse(output)).toEqual(output);
  });

  it.for([
    { label: '4 topics', patch: { topics: repeated(4, TOPIC) }, path: 'topics' },
    { label: 'a 9th topic', patch: { topics: repeated(9, TOPIC) }, path: 'topics' },
    {
      label: 'a topic without its basis',
      patch: { topics: [{ ...TOPIC, basis: '' }, ...repeated(4, TOPIC)] },
      path: 'topics.0.basis',
    },
    {
      label: 'a 201-character why',
      patch: { topics: [{ ...TOPIC, why: 'б'.repeat(201) }, ...repeated(4, TOPIC)] },
      path: 'topics.0.why',
    },
    { label: '9 questions', patch: { questions: repeated(9, QUESTION) }, path: 'questions' },
    { label: '11 questions', patch: { questions: repeated(11, QUESTION) }, path: 'questions' },
    {
      label: 'a 241-character hint',
      patch: { questions: [{ ...QUESTION, hint: 'х'.repeat(241) }, ...repeated(9, QUESTION)] },
      path: 'questions.0.hint',
    },
    {
      label: '2 questions to the company',
      patch: { askCompany: ['Хто в команді?', 'Як рев’ю?'] },
      path: 'askCompany',
    },
    {
      label: 'a 4-minute step',
      patch: { plan30: [{ ...STEP, minutes: 4 }] },
      path: 'plan30.0.minutes',
    },
    {
      label: 'a fractional step',
      patch: { plan30: [{ ...STEP, minutes: 7.5 }] },
      path: 'plan30.0.minutes',
    },
    { label: 'an empty 30-minute plan', patch: { plan30: [] }, path: 'plan30' },
    {
      label: 'a 30-minute plan that takes 35 minutes',
      patch: { plan30: [STEP, { ...STEP, minutes: 20 }] },
      path: 'plan30',
    },
    {
      label: 'a 2-hour plan that takes 125 minutes',
      patch: {
        plan120: [
          { ...STEP, minutes: 120 },
          { ...STEP, minutes: 5 },
        ],
      },
      path: 'plan120',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    const result = interviewPrepOutputSchema.safeParse({ ...INTERVIEW_PREP_OUTPUT, ...patch });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});
