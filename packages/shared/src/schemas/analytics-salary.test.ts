import { describe, expect, it } from 'vitest';

import { buildDesignSalary, buildNoSalary } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { salaryResponseSchema } from './analytics-salary.js';

const DESIGN_SALARY = buildDesignSalary();

const NO_SALARY = buildNoSalary({ missing: 4, unconverted: 1 });

describe('salaryResponseSchema', () => {
  it('accepts the design salary with a $4 900 median and a $4 500 floor after two rejections', () => {
    expect(salaryResponseSchema.parse(DESIGN_SALARY)).toEqual(DESIGN_SALARY);
    expect(DESIGN_SALARY.median).toBe(4900);
    expect(DESIGN_SALARY.floor).toEqual({
      floor: 4500,
      rejections: 2,
      below: 7,
      perMonthLow: 3,
      perMonthHigh: 4,
    });
    expect(DESIGN_SALARY.outcomes.map(({ key, low, high }) => [key, low, high])).toEqual([
      ['offer', 5800, 5800],
      ['salary_rejection', 3800, 4100],
      ['other', 4500, 6000],
    ]);
  });

  it('accepts a scope where no application carries a salary', () => {
    expect(salaryResponseSchema.parse(NO_SALARY)).toEqual(NO_SALARY);
  });

  it.for([
    {
      label: 'an unknown outcome',
      body: { ...NO_SALARY, outcomes: [{ ...DESIGN_SALARY.outcomes[0], key: 'rejected' }] },
      path: 'outcomes.0.key',
    },
    {
      label: 'an unknown seniority',
      body: { ...NO_SALARY, seniority: [{ ...DESIGN_SALARY.seniority[0], key: 'principal' }] },
      path: 'seniority.0.key',
    },
    {
      label: 'a stack without its name',
      body: { ...NO_SALARY, stack: [{ ...DESIGN_SALARY.stack[0], key: undefined }] },
      path: 'stack.0.key',
    },
    {
      label: 'a fractional median in dollars',
      body: { ...NO_SALARY, median: 4900.5 },
      path: 'median',
    },
    {
      label: 'a negative count of missing salaries',
      body: { ...NO_SALARY, missing: -1 },
      path: 'missing',
    },
    {
      label: 'a floor without its rejections',
      body: { ...NO_SALARY, floor: { ...DESIGN_SALARY.floor, rejections: undefined } },
      path: 'floor.rejections',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(salaryResponseSchema.safeParse(body))).toEqual([path]);
  });
});
