import { describe, expect, it } from 'vitest';

import { buildVacancyParseOutput, vacancyFieldOf } from '../../testing/index.js';
import type { ApplicationMatchResponse } from '../schemas/match.js';
import { interviewPrepGapsOf, interviewPrepRequirementsOf } from './interview-prep-material.js';

const PARSED_WITH_REQUIREMENTS = buildVacancyParseOutput({
  requirements: vacancyFieldOf(['  Kafka  ', 'Kubernetes', '   '], 'Kafka, Kubernetes'),
});

const DEVOPS_MATCH: NonNullable<ApplicationMatchResponse['match']> = {
  score: 58,
  matched: [
    { name: 'Docker', weight: 'must', coverage: 'full', pointsLost: 0 },
    { name: 'Helm', weight: 'nice', coverage: 'partial', pointsLost: 4 },
    { name: 'Ansible', weight: 'must', coverage: 'partial', pointsLost: 6 },
  ],
  missing: [
    { name: 'Go', weight: 'nice', pointsLost: 4 },
    { name: 'Terraform', weight: 'must', pointsLost: 12 },
  ],
  ignored: [],
  explanation: 'Контейнери є, бракує Terraform.',
  resumeVersion: { id: '7d1c2a4e-3b5f-4c6d-8e9f-0a1b2c3d4e5f', number: 2, title: 'DevOps CV' },
  computedAt: '2026-11-02T09:30:00.000Z',
};

describe('interviewPrepRequirementsOf', () => {
  it('trims the parsed requirements and the stack, drops blanks and keeps each name once', () => {
    expect(
      interviewPrepRequirementsOf({
        aiParsed: PARSED_WITH_REQUIREMENTS,
        stack: ['Kafka', ' Rust ', ''],
      }),
    ).toEqual(['Kafka', 'Kubernetes', 'Rust']);
  });

  it('keeps the first 16 requirements when the stack runs longer', () => {
    const stack = Array.from({ length: 21 }, (_, index) => `Tool ${String(index)}`);
    const requirements = interviewPrepRequirementsOf({ aiParsed: null, stack });
    expect(requirements).toHaveLength(16);
    expect(requirements.at(-1)).toBe('Tool 15');
  });

  it.for([
    { label: 'no parsed vacancy', aiParsed: null },
    { label: 'a parsed vacancy of an older shape', aiParsed: { seniority: 'junior' } },
  ])('falls back to the stack alone for $label', ({ aiParsed }) => {
    expect(interviewPrepRequirementsOf({ aiParsed, stack: ['Elixir', ' Phoenix '] })).toEqual([
      'Elixir',
      'Phoenix',
    ]);
  });
});

describe('interviewPrepGapsOf', () => {
  it('gives no gaps when the application has no Match Score', () => {
    expect(interviewPrepGapsOf(null)).toEqual([]);
  });

  it('ranks missing and partial requirements by points lost, then name, and drops full coverage', () => {
    expect(interviewPrepGapsOf(DEVOPS_MATCH)).toEqual([
      { name: 'Terraform', coverage: 'missing' },
      { name: 'Ansible', coverage: 'partial' },
      { name: 'Go', coverage: 'missing' },
      { name: 'Helm', coverage: 'partial' },
    ]);
  });
});
