import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  createApplicationInputSchema,
  STACK_MAX_ITEMS,
  updateApplicationInputSchema,
} from './application.js';

const STAGE_HINT = 'Stage changes go through POST /applications/:id/events';
const required = { company: 'Vela', position: 'Frontend Engineer' };
const stackOf = (length: number) => Array.from({ length }, (_, index) => `tool-${String(index)}`);

const issuesOf = ({ error }: { error?: z.ZodError | undefined }) =>
  error?.issues.map(({ path, message }) => ({ path: path.join('.'), message })) ?? [];

const issuePathsOf = (result: { error?: z.ZodError | undefined }) =>
  issuesOf(result).map(({ path }) => path);

describe('createApplicationInputSchema', () => {
  it('trims company and position and fills source other and an empty stack', () => {
    expect(
      createApplicationInputSchema.parse({ company: '  Vela ', position: ' Frontend Engineer ' }),
    ).toEqual({ company: 'Vela', position: 'Frontend Engineer', source: 'other', stack: [] });
  });

  it('keeps every optional field and strips keys the body never carries', () => {
    const body = {
      ...required,
      url: 'https://jobs.vela.example/42',
      source: 'djinni',
      salaryMin: 4700,
      salaryMax: 5900,
      currency: 'USD',
      stack: ['React', 'TypeScript'],
      location: 'Київ',
      workMode: 'remote',
    };
    const extra = { currentStage: 'offer', isDraft: true, matchScore: 99, rawText: 'x' };
    expect(createApplicationInputSchema.parse({ ...body, ...extra })).toEqual(body);
  });

  it.each(['UAH', 'USD', 'EUR', 'PLN'])('accepts the ISO currency %s', (currency) => {
    expect(createApplicationInputSchema.safeParse({ ...required, currency }).success).toBe(true);
  });

  it('accepts a stack at the 20 item limit', () => {
    const stack = stackOf(STACK_MAX_ITEMS);
    expect(createApplicationInputSchema.parse({ ...required, stack }).stack).toEqual(stack);
  });

  it.for([
    {
      label: 'salaryMin above salaryMax',
      body: { salaryMin: 6000, salaryMax: 5000 },
      path: 'salaryMin',
    },
    { label: 'a lowercase currency', body: { currency: 'usd' }, path: 'currency' },
    { label: 'a currency outside ISO 4217', body: { currency: 'XYZ' }, path: 'currency' },
    { label: 'a javascript: url', body: { url: 'javascript:alert(1)' }, path: 'url' },
    { label: 'a url that is not a URL', body: { url: 'not a url' }, path: 'url' },
    { label: '21 stack items', body: { stack: stackOf(21) }, path: 'stack' },
    { label: 'an empty stack item', body: { stack: ['React', '  '] }, path: 'stack.1' },
    { label: 'a missing company', body: { company: undefined }, path: 'company' },
    { label: 'a missing position', body: { position: undefined }, path: 'position' },
    { label: 'a blank company', body: { company: '   ' }, path: 'company' },
    { label: 'a negative salaryMin', body: { salaryMin: -1 }, path: 'salaryMin' },
    {
      label: 'a salaryMin past the 32-bit integer column',
      body: { salaryMin: 2147483648 },
      path: 'salaryMin',
    },
  ])('refuses $label', ({ body, path }) => {
    expect(issuePathsOf(createApplicationInputSchema.safeParse({ ...required, ...body }))).toEqual([
      path,
    ]);
  });
});

describe('updateApplicationInputSchema', () => {
  it('accepts a partial edit without filling any default', () => {
    expect(updateApplicationInputSchema.parse({ location: 'Львів' })).toEqual({
      location: 'Львів',
    });
  });

  it('accepts salaryMin and salaryMax sent together, and both cleared', () => {
    expect(updateApplicationInputSchema.parse({ salaryMin: 4700, salaryMax: 5900 })).toEqual({
      salaryMin: 4700,
      salaryMax: 5900,
    });
    expect(
      updateApplicationInputSchema.safeParse({ salaryMin: null, salaryMax: null }).success,
    ).toBe(true);
  });

  it.for([
    { label: 'an empty body', body: {}, path: '' },
    { label: 'a body with unknown keys only', body: { isDraft: true }, path: '' },
    { label: 'a lone salaryMin', body: { salaryMin: 4700 }, path: 'salaryMin' },
    { label: 'a lone salaryMax', body: { salaryMax: 5900 }, path: 'salaryMin' },
    {
      label: 'salaryMin above salaryMax',
      body: { salaryMin: 6000, salaryMax: 5000 },
      path: 'salaryMin',
    },
    { label: 'a currency outside ISO 4217', body: { currency: 'XYZ' }, path: 'currency' },
    { label: 'a blank position', body: { position: '' }, path: 'position' },
  ])('refuses $label', ({ body, path }) => {
    expect(issuePathsOf(updateApplicationInputSchema.safeParse(body))).toEqual([path]);
  });

  it.for([
    { label: 'alone', body: { currentStage: 'screening' } },
    { label: 'next to another field', body: { currentStage: 'screening', company: 'Bereza' } },
  ])('refuses currentStage $label with the hint to use events', ({ body }) => {
    expect(issuesOf(updateApplicationInputSchema.safeParse(body))).toEqual([
      { path: 'currentStage', message: STAGE_HINT },
    ]);
  });
});
