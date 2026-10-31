import { describe, expect, it } from 'vitest';

import { buildVacancyCompletion } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { aiCompleteRequestSchemas, aiCompletionSchemas } from './completion.js';
import { aiContractJsonSchemas } from './contracts.js';
import { aiEmbedRequestSchema } from './embed.js';
import { AI_KINDS, AI_PROMPT_VERSIONS } from './kinds.js';

const VACANCY_INPUT = { text: 'Senior React developer, Acme, remote, 4000-5000 USD' };

const COMPLETION = buildVacancyCompletion();

describe('AI_PROMPT_VERSIONS', () => {
  it('pins one prompt version for exactly the AI kinds', () => {
    expect(Object.keys(AI_PROMPT_VERSIONS)).toEqual([...AI_KINDS]);
    expect(AI_PROMPT_VERSIONS).toEqual({ vacancy_parse: 'v1' });
  });
});

describe('aiContractJsonSchemas', () => {
  it('converts a request, output and response per kind and the embed pair with nothing unrepresentable', () => {
    expect(Object.keys(aiContractJsonSchemas())).toEqual([
      'vacancy_parse_request',
      'vacancy_parse_output',
      'vacancy_parse_response',
      'embed_request',
      'embed_response',
    ]);
  });

  it('requires every vacancy_parse output field, the nullable ones included', () => {
    expect(aiContractJsonSchemas()['vacancy_parse_output']).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'VacancyParseOutput',
      type: 'object',
      required: [
        'company',
        'position',
        'location',
        'workMode',
        'salaryMin',
        'salaryMax',
        'currency',
        'stack',
      ],
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
