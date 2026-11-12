import { describe, expect, it } from 'vitest';

import { RESUME_PROFILE } from '../test/ai.js';
import type { ResumeExpected } from './resume-cases.js';
import { resumeReport } from './resume-score.js';

const EXPECTED: ResumeExpected = {
  skills: ['React', 'TypeScript', 'Next.js', 'Jest'],
  seniority: 'middle',
  englishLevel: 'intermediate',
};

const answered = (ms: number) => ({
  file: '01-cv.pdf',
  expected: EXPECTED,
  output: RESUME_PROFILE,
  ms,
});

describe('resumeReport', () => {
  it('reports the share of expected skills found, case-blind, with seniority, English and time', () => {
    const report = resumeReport([
      {
        ...answered(8_000),
        expected: { ...EXPECTED, skills: ['react', ' TypeScript ', 'Jest', 'CSS'] },
      },
    ]);

    expect(report).toEqual({
      lines: [
        'case\tskills_recall\tseniority\tenglish\tms\tresult',
        '01-cv.pdf\t0.500\tmiddle/middle\tintermediate/upper_intermediate\t8000\tPASS',
        '',
        'skills_recall_mean\t0.500',
        'case_ms_limit\t15000',
        'PASS',
      ],
      passed: true,
    });
  });

  it('passes a case at exactly 15 000 ms and fails the run for a case one ms over', () => {
    const report = resumeReport([answered(15_000), { ...answered(15_001), file: '02-cv.docx' }]);

    expect(report.lines.slice(1, 3)).toEqual([
      '01-cv.pdf\t0.500\tmiddle/middle\tintermediate/upper_intermediate\t15000\tPASS',
      '02-cv.docx\t0.500\tmiddle/middle\tintermediate/upper_intermediate\t15001\tFAIL',
    ]);
    expect(report.passed).toBe(false);
    expect(report.lines.at(-1)).toBe('FAIL');
  });

  it('counts a refused case as recall 0 and fails the run', () => {
    const report = resumeReport([
      answered(9_000),
      { file: '02-cv.docx', expected: EXPECTED, error: 'ai_invalid_output', ms: 3_000 },
    ]);

    expect(report.lines).toEqual(
      expect.arrayContaining([
        '02-cv.docx\t0.000\tai_invalid_output\tai_invalid_output\t3000\tFAIL',
        'skills_recall_mean\t0.250',
      ]),
    );
    expect(report.passed).toBe(false);
  });
});
