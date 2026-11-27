import { describe, expect, it } from 'vitest';

import {
  buildMatchCompletion,
  buildMonthlySummaryOutput,
  buildResumeParseOutput,
  buildVacancyCompletion,
  CV_HINTS_OUTPUT,
  INTERVIEW_PREP_OUTPUT,
  VACANCY_SAMPLE_TEXT,
} from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { aiCompleteRequestSchemas, aiCompletionSchemas } from './completion.js';
import { aiContractJsonSchemas } from './contracts.js';
import { aiEmbedRequestSchema } from './embed.js';
import { AI_KINDS, AI_PROMPT_VERSIONS } from './kinds.js';
import { AI_PAYLOAD_FIELDS } from './payload-fields.js';

const VACANCY_INPUT = { text: VACANCY_SAMPLE_TEXT };

const COMPLETION = buildVacancyCompletion();

const VACANCY_OUTPUT_FIELDS = [
  'company',
  'position',
  'seniority',
  'salaryMin',
  'salaryMax',
  'currency',
  'salaryTax',
  'location',
  'workMode',
  'stack',
  'requirements',
  'englishLevel',
  'sourceGuess',
];

describe('AI_PROMPT_VERSIONS', () => {
  it('pins one prompt version for exactly the AI kinds', () => {
    expect(Object.keys(AI_PROMPT_VERSIONS)).toEqual([...AI_KINDS]);
    expect(AI_PROMPT_VERSIONS).toEqual({
      vacancy_parse: 'v4',
      resume_parse: 'v1',
      match: 'v4',
      followup: 'v3',
      monthly_summary: 'v2',
      cv_hints: 'v1',
      interview_prep: 'v1',
    });
  });
});

describe('aiContractJsonSchemas', () => {
  it('converts a request, output and response per kind and the embed pair with nothing unrepresentable', () => {
    expect(Object.keys(aiContractJsonSchemas())).toEqual([
      'vacancy_parse_request',
      'vacancy_parse_output',
      'vacancy_parse_response',
      'resume_parse_request',
      'resume_parse_output',
      'resume_parse_response',
      'match_request',
      'match_output',
      'match_response',
      'followup_request',
      'followup_output',
      'followup_response',
      'monthly_summary_request',
      'monthly_summary_output',
      'monthly_summary_response',
      'cv_hints_request',
      'cv_hints_output',
      'cv_hints_response',
      'interview_prep_request',
      'interview_prep_output',
      'interview_prep_response',
      'embed_request',
      'embed_response',
    ]);
  });

  it('requires every vacancy_parse output field, the nullable ones included', () => {
    expect(aiContractJsonSchemas()['vacancy_parse_output']).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'VacancyParseOutput',
      type: 'object',
      required: VACANCY_OUTPUT_FIELDS,
    });
  });

  it.for(VACANCY_OUTPUT_FIELDS)(
    'requires a value, a confidence and a quote in the %s field',
    (field) => {
      expect(aiContractJsonSchemas()['vacancy_parse_output']).toMatchObject({
        properties: { [field]: { type: 'object', required: ['value', 'confidence', 'evidence'] } },
      });
    },
  );

  it('requires every resume_parse output field, the nullable ones included', () => {
    expect(aiContractJsonSchemas()['resume_parse_output']).toMatchObject({
      title: 'ResumeParseOutput',
      required: [
        'positions',
        'skills',
        'totalYears',
        'seniority',
        'englishLevel',
        'domains',
        'leadership',
        'languages',
      ],
    });
  });

  it('requires the vacancy and the profile in a match request, and the requirements and the explanation in its output', () => {
    expect(aiContractJsonSchemas()).toMatchObject({
      match_request: { properties: { input: { required: ['vacancy', 'profile'] } } },
      match_output: { title: 'MatchOutput', required: ['requirements', 'explanation'] },
    });
  });

  it('requires every followup input field, the nullable ones included, and the subject and the body in its output', () => {
    expect(aiContractJsonSchemas()).toMatchObject({
      followup_request: {
        properties: {
          input: { required: AI_PAYLOAD_FIELDS.followup },
        },
      },
      followup_output: { title: 'FollowupOutput', required: ['subject', 'body'] },
    });
  });

  it('requires every monthly_summary input block, the nullable ones included, and the summary with its actions in its output', () => {
    expect(aiContractJsonSchemas()).toMatchObject({
      monthly_summary_request: {
        properties: { input: { required: AI_PAYLOAD_FIELDS.monthly_summary } },
      },
      monthly_summary_output: {
        title: 'MonthlySummaryOutput',
        required: ['summary', 'actions'],
        properties: {
          actions: {
            minItems: 1,
            maxItems: 4,
            items: { required: ['title', 'why', 'expectedEffect', 'metric'] },
          },
        },
      },
    });
  });

  it('requires every cv_hints input block, and at most 5 hints with every field plus the gaps in its output', () => {
    expect(aiContractJsonSchemas()).toMatchObject({
      cv_hints_request: { properties: { input: { required: AI_PAYLOAD_FIELDS.cv_hints } } },
      cv_hints_output: {
        title: 'CvHintsOutput',
        required: ['hints', 'gaps'],
        properties: {
          hints: {
            maxItems: 5,
            items: {
              required: ['requirement', 'evidenceInCv', 'suggestion', 'expectedScoreImpact'],
            },
          },
          gaps: { maxItems: 15 },
        },
      },
    });
  });

  it('requires every interview_prep input block with its weak spot codes, and 5 to 8 topics with a basis, 10 questions, 3 questions to the company and both plans in its output', () => {
    expect(aiContractJsonSchemas()).toMatchObject({
      interview_prep_request: {
        properties: {
          input: {
            required: AI_PAYLOAD_FIELDS.interview_prep,
            properties: { weakSpots: { required: ['reasons', 'topics'] } },
          },
        },
      },
      interview_prep_output: {
        title: 'InterviewPrepOutput',
        required: ['topics', 'questions', 'askCompany', 'plan30', 'plan120'],
        properties: {
          topics: { minItems: 5, maxItems: 8, items: { required: ['name', 'why', 'basis'] } },
          questions: { minItems: 10, maxItems: 10, items: { required: ['question', 'hint'] } },
          askCompany: { minItems: 3, maxItems: 3 },
          plan30: { minItems: 1, maxItems: 6, items: { required: ['minutes', 'task'] } },
        },
      },
    });
  });

  it('requires only the input in a completion request', () => {
    expect(aiContractJsonSchemas()['vacancy_parse_request']).toMatchObject({
      title: 'VacancyParseRequest',
      required: ['input'],
    });
  });
});

describe('aiCompleteRequestSchemas', () => {
  it('accepts a vacancy_parse request without options', () => {
    expect(aiCompleteRequestSchemas.vacancy_parse.parse({ input: VACANCY_INPUT })).toEqual({
      input: VACANCY_INPUT,
    });
  });

  it.for([
    { label: 'a temperature above 1', options: { temperature: 1.5 }, path: 'temperature' },
    { label: 'a negative temperature', options: { temperature: -0.1 }, path: 'temperature' },
    { label: 'zero maxTokens', options: { maxTokens: 0 }, path: 'maxTokens' },
    { label: 'maxTokens above 4096', options: { maxTokens: 4097 }, path: 'maxTokens' },
    { label: 'fractional maxTokens', options: { maxTokens: 10.5 }, path: 'maxTokens' },
  ])('refuses $label', ({ options, path }) => {
    const result = aiCompleteRequestSchemas.vacancy_parse.safeParse({
      input: VACANCY_INPUT,
      ...options,
    });
    expect(issuePathsOf(result)).toEqual([path]);
  });
});

describe('aiCompletionSchemas', () => {
  it('parses a vacancy_parse completion', () => {
    expect(aiCompletionSchemas.vacancy_parse.parse(COMPLETION)).toEqual(COMPLETION);
  });

  it('parses a resume_parse completion carrying the profile', () => {
    const completion = { ...COMPLETION, promptVersion: 'v1', output: buildResumeParseOutput() };
    expect(aiCompletionSchemas.resume_parse.parse(completion)).toEqual(completion);
  });

  it('parses a match completion carrying the requirement mapping', () => {
    const completion = buildMatchCompletion();
    expect(aiCompletionSchemas.match.parse(completion)).toEqual(completion);
  });

  it('parses a monthly_summary completion carrying the summary and its actions', () => {
    const completion = { ...COMPLETION, promptVersion: 'v1', output: buildMonthlySummaryOutput() };
    expect(aiCompletionSchemas.monthly_summary.parse(completion)).toEqual(completion);
  });

  it('parses a cv_hints completion carrying the hints and the gaps', () => {
    const completion = { ...COMPLETION, promptVersion: 'v1', output: CV_HINTS_OUTPUT };
    expect(aiCompletionSchemas.cv_hints.parse(completion)).toEqual(completion);
  });

  it('parses an interview_prep completion carrying the topics, the questions and both plans', () => {
    const completion = { ...COMPLETION, promptVersion: 'v1', output: INTERVIEW_PREP_OUTPUT };
    expect(aiCompletionSchemas.interview_prep.parse(completion)).toEqual(completion);
  });

  it('refuses a numeric promptVersion', () => {
    const result = aiCompletionSchemas.vacancy_parse.safeParse({ ...COMPLETION, promptVersion: 1 });
    expect(issuePathsOf(result)).toEqual(['promptVersion']);
  });
});

describe('aiEmbedRequestSchema', () => {
  it.for([
    { label: 'an empty text list', request: { texts: [], inputType: 'query' }, path: 'texts' },
    {
      label: '65 texts',
      request: { texts: Array.from({ length: 65 }, () => 'React'), inputType: 'passage' },
      path: 'texts',
    },
    { label: 'a blank text', request: { texts: ['  '], inputType: 'query' }, path: 'texts.0' },
    {
      label: 'an unknown input type',
      request: { texts: ['React'], inputType: 'document' },
      path: 'inputType',
    },
  ])('refuses $label', ({ request, path }) => {
    expect(issuePathsOf(aiEmbedRequestSchema.safeParse(request))).toEqual([path]);
  });
});
