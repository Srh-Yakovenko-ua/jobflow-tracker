import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadResumeCases, type ResumeEvalCase } from './resume-cases.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/resume', import.meta.url));

describe('the resume eval cases', () => {
  let cases: ResumeEvalCase[];

  beforeAll(async () => {
    cases = await loadResumeCases(CASES_DIR);
  });

  it('holds five expected files, each beside its PDF or DOCX', () => {
    expect(cases.map(({ document }) => document)).toEqual([
      '01-backend-senior-two-pages.pdf',
      '02-frontend-middle.docx',
      '03-qa-junior.pdf',
      '04-devops-lead.docx',
      '05-java-middle-scan.pdf',
    ]);
  });

  it('expects every seniority from junior to lead', () => {
    expect(new Set(cases.map(({ expected }) => expected.seniority))).toEqual(
      new Set(['junior', 'middle', 'senior', 'lead']),
    );
  });
});
