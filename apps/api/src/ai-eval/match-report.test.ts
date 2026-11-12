import { describe, expect, it } from 'vitest';

import { type MatchCaseAnswer, matchReport } from './match-report.js';

const answersOf = (scores: (number | null)[]): MatchCaseAnswer[] =>
  scores.map((score, index) => ({
    file: `${String(index + 1).padStart(2, '0')}.json`,
    manualRank: index + 1,
    score,
  }));

describe('matchReport', () => {
  it('passes with rho 1 when the scores rank the cases like the manual ranking', () => {
    const report = matchReport(answersOf([90, 70, 40, 10]));

    expect(report.lines).toEqual([
      'case\tmanual_rank\tscore\tscore_rank',
      '01.json\t1\t90\t1',
      '02.json\t2\t70\t2',
      '03.json\t3\t40\t3',
      '04.json\t4\t10\t4',
      '',
      'rho\t1.000',
      'rho_min\t0.7',
      'PASS',
    ]);
    expect(report.passed).toBe(true);
  });

  it('fails with rho -1 when the scores rank the cases the other way round', () => {
    const report = matchReport(answersOf([10, 40, 70, 90]));

    expect(report.lines.slice(-3)).toEqual(['rho\t-1.000', 'rho_min\t0.7', 'FAIL']);
    expect(report.passed).toBe(false);
  });

  it('gives tied scores their average rank', () => {
    const report = matchReport(answersOf([90, 80, 80, 10]));

    expect(report.lines.slice(2, 4)).toEqual(['02.json\t2\t80\t2.5', '03.json\t3\t80\t2.5']);
    expect(report.lines).toContain('rho\t0.949');
    expect(report.passed).toBe(true);
  });

  it('gives tied manual ranks their average rank', () => {
    const answers = answersOf([90, 80, 70, 10]).map((answer, index) =>
      index === 2 ? { ...answer, manualRank: 2 } : answer,
    );

    expect(matchReport(answers).lines).toContain('rho\t0.949');
  });

  it('ranks a case without requirements or with a refused answer last with score 0', () => {
    const answers: MatchCaseAnswer[] = [
      ...answersOf([90, 70, null]),
      { file: '04.json', manualRank: 4, error: 'ai_invalid_output' },
    ];

    const report = matchReport(answers);

    expect(report.lines.slice(3, 5)).toEqual([
      '03.json\t3\t0 no_requirements\t3.5',
      '04.json\t4\t0 ai_invalid_output\t3.5',
    ]);
    expect(report.lines).toContain('rho\t0.949');
  });

  it('fails when every score is the same and rho is undefined', () => {
    const report = matchReport(answersOf([59, 59, 59]));

    expect(report.lines.slice(-3)).toEqual(['rho\tNaN', 'rho_min\t0.7', 'FAIL']);
    expect(report.passed).toBe(false);
  });
});
