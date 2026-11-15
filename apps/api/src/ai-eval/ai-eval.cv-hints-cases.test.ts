import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cvHintsInputSchema } from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { RESUME_PROFILE } from '../test/ai.js';
import { type CvHintsEvalCase, loadCvHintsCases } from './cv-hints-cases.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/cv-hints', import.meta.url));

const ONE_CASE = {
  position: 'Senior React Developer',
  requirements: [{ name: 'GraphQL', weight: 'must', coverage: 'partial' }],
  explanation: 'GraphQL частково.',
  absent: ['AWS'],
};

async function evalTree(evalCase: object): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'jobflow-cv-hints-eval-'));
  const [matchDir, hintsDir] = [join(root, 'match'), join(root, 'cv-hints')];
  await Promise.all([mkdir(matchDir), mkdir(hintsDir)]);
  await Promise.all([
    writeFile(join(matchDir, 'cv.json'), JSON.stringify(RESUME_PROFILE)),
    writeFile(join(hintsDir, '01-a.json'), JSON.stringify(evalCase)),
  ]);
  return hintsDir;
}

const namesOf = (evalCase: CvHintsEvalCase, coverage: string) =>
  evalCase.input.requirements.filter((row) => row.coverage === coverage).map(({ name }) => name);

function absentInProfile({ file, input, absent }: CvHintsEvalCase): string[] {
  const profile = JSON.stringify(input.profile).toLowerCase();
  return absent
    .filter((term) => profile.includes(term.toLowerCase()))
    .map((term) => `${file}: ${term}`);
}

describe('the cv hints eval cases', () => {
  let cases: CvHintsEvalCase[];

  beforeAll(async () => {
    cases = await loadCvHintsCases(CASES_DIR);
  });

  it('builds eight valid cv hints inputs against the sample CV', () => {
    expect(cases).toHaveLength(8);
    expect(cases.filter(({ input }) => !cvHintsInputSchema.safeParse(input).success)).toEqual([]);
  });

  it('scores a case with the match scoring code and ranks its requirements by lost points', () => {
    expect(cases[0]?.input).toMatchObject({
      position: 'Senior Full Stack Engineer',
      score: 58,
      requirements: [
        { name: 'AWS (Lambda, S3)', weight: 'must', coverage: 'missing', pointsLost: 23 },
        { name: 'GraphQL API', weight: 'must', coverage: 'partial', pointsLost: 12 },
        { name: 'Kafka', weight: 'nice', coverage: 'missing', pointsLost: 8 },
        { name: 'Node.js', weight: 'must', coverage: 'full', pointsLost: 0 },
        { name: 'React + TypeScript', weight: 'must', coverage: 'full', pointsLost: 0 },
      ],
    });
  });

  it('gives every case a partial requirement to hint at and a missing one to list as a gap', () => {
    const uncovered = cases.filter(
      (evalCase) =>
        namesOf(evalCase, 'partial').length === 0 || namesOf(evalCase, 'missing').length === 0,
    );

    expect(uncovered.map(({ file }) => file)).toEqual([]);
  });

  it('names as absent only terms the CV profile never mentions', () => {
    const named = cases.flatMap(absentInProfile);

    expect(named).toEqual([]);
  });

  it('sends the evidence lines and position titles, without employers or languages', () => {
    const profile = JSON.stringify(cases[0]?.input.profile);

    expect(profile).toContain('Added a GraphQL gateway for the mobile client');
    expect(profile).toContain('Senior Full Stack Developer');
    expect(profile).not.toMatch(/Lumenrail|Українська/);
  });

  it.each([
    {
      case: 'weighs no requirement',
      evalCase: {
        ...ONE_CASE,
        requirements: [{ name: 'Kotlin', weight: 'mentioned', coverage: 'missing' }],
      },
      error: 'Eval case 01-a.json is malformed: it weighs no requirement',
    },
    {
      case: 'carries a field the case format does not have',
      evalCase: { ...ONE_CASE, expected: [] },
      error: 'Eval case 01-a.json is malformed',
    },
    {
      case: 'names no absent term',
      evalCase: { ...ONE_CASE, absent: [] },
      error: 'Eval case 01-a.json is malformed',
    },
  ])('refuses a case that $case', async ({ evalCase, error }) => {
    await expect(loadCvHintsCases(await evalTree(evalCase))).rejects.toThrow(error);
  });
});
