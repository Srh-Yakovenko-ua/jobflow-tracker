import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchInputSchema } from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { RESUME_PROFILE, VACANCY_EVAL_CASE } from '../test/ai.js';
import { loadMatchCases, type MatchEvalCase, type MatchRanking } from './match-cases.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/match', import.meta.url));

async function evalTree(ranking: MatchRanking): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'jobflow-match-eval-'));
  const [matchDir, vacancyDir] = [join(root, 'match'), join(root, 'vacancy')];
  await Promise.all([mkdir(matchDir), mkdir(vacancyDir)]);
  await Promise.all([
    writeFile(join(matchDir, 'cv.json'), JSON.stringify(RESUME_PROFILE)),
    writeFile(join(matchDir, 'ranking.json'), JSON.stringify(ranking)),
    writeFile(join(vacancyDir, '01-a.json'), JSON.stringify(VACANCY_EVAL_CASE)),
    writeFile(join(vacancyDir, '02-b.json'), JSON.stringify(VACANCY_EVAL_CASE)),
  ]);
  return matchDir;
}

describe('the match eval cases', () => {
  let cases: MatchEvalCase[];

  beforeAll(async () => {
    cases = await loadMatchCases(CASES_DIR);
  });

  it('ranks every one of the 15 vacancy cases by hand, best first', () => {
    expect(cases).toHaveLength(15);
    expect(cases.find(({ rank }) => rank === 1)?.file).toBe('14-dou-en-fullstack-hybrid-kyiv.json');
    expect(cases.find(({ rank }) => rank === 15)?.file).toBe('11-djinni-uk-flutter-junior.json');
  });

  it('builds a valid match input from each case text, its expected position and stack and the sample CV', () => {
    expect(cases.filter(({ input }) => !matchInputSchema.safeParse(input).success)).toEqual([]);
    expect(cases[13]?.input.vacancy).toMatchObject({
      position: 'Senior Full Stack Engineer',
      stack: ['TypeScript', 'React', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'],
    });
  });

  it('names a case without an expected position as an unnamed vacancy', () => {
    expect(cases[11]?.input.vacancy.position).toBe('Вакансія без назви');
  });

  it('sends a senior full-stack TypeScript profile with no AWS and no lead experience, without evidence or employers', () => {
    const profile = cases[0]?.input.profile;

    expect(profile).toMatchObject({
      seniority: 'senior',
      englishLevel: 'upper_intermediate',
      leadership: { hasExperience: false },
    });
    expect(profile?.skills.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL']),
    );
    expect(JSON.stringify(profile)).not.toMatch(/AWS|evidence|Lumenrail/);
  });

  it.each([
    {
      case: 'misses a vacancy case',
      ranks: [{ file: '01-a.json', rank: 1 }],
      error: 'Eval ranking has no rank for 02-b.json',
    },
    {
      case: 'names a case twice',
      ranks: [
        { file: '01-a.json', rank: 1 },
        { file: '01-a.json', rank: 2 },
      ],
      error: 'Eval ranking names 01-a.json twice or as no vacancy case',
    },
    {
      case: 'names a file that is no vacancy case',
      ranks: [
        { file: '01-a.json', rank: 1 },
        { file: '02-b.json', rank: 2 },
        { file: '03-c.json', rank: 3 },
      ],
      error: 'Eval ranking names 03-c.json twice or as no vacancy case',
    },
  ])('refuses a ranking that $case', async ({ ranks, error }) => {
    await expect(loadMatchCases(await evalTree({ ranks }))).rejects.toThrow(error);
  });
});
