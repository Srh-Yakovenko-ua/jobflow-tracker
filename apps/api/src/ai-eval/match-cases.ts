import { join } from 'node:path';

import { type MatchInput, type ResumeParseOutput, resumeParseOutputSchema } from '@jobflow/shared';
import { z } from 'zod';

import { AI_PAYLOAD_BUILDERS } from '../modules/ai/index.js';
import { loadEvalFile } from './eval-cases.js';
import { loadVacancyCases, type VacancyEvalCase } from './vacancy-cases.js';

export const MATCH_EVAL_FILES = {
  cv: 'cv.json',
  ranking: 'ranking.json',
  vacancyDir: '../vacancy',
  unnamedPosition: 'Вакансія без назви',
} as const;

export const matchRankingSchema = z.strictObject({
  ranks: z.array(z.strictObject({ file: z.string().min(1), rank: z.int().positive() })).min(1),
});

export type MatchRanking = z.infer<typeof matchRankingSchema>;

export type MatchEvalCase = { file: string; rank: number; input: MatchInput };

function rankByFile({ ranks }: MatchRanking, files: string[]): Map<string, number> {
  const byFile = new Map<string, number>();
  for (const { file, rank } of ranks) {
    if (byFile.has(file) || !files.includes(file)) {
      throw new Error(`Eval ranking names ${file} twice or as no vacancy case`);
    }
    byFile.set(file, rank);
  }
  const unranked = files.filter((file) => !byFile.has(file));
  if (unranked.length > 0) {
    throw new Error(`Eval ranking has no rank for ${unranked.join(', ')}`);
  }
  return byFile;
}

const firstSpelling = (position: VacancyEvalCase['expected']['position']) =>
  (Array.isArray(position) ? position[0] : position) ?? MATCH_EVAL_FILES.unnamedPosition;

function inputOf({ text, expected }: VacancyEvalCase, cv: ResumeParseOutput): MatchInput {
  return AI_PAYLOAD_BUILDERS.match({
    position: firstSpelling(expected.position),
    stack: expected.stack,
    rawText: text,
    profile: cv,
  });
}

export async function loadMatchCases(casesDir: string): Promise<MatchEvalCase[]> {
  const [cv, ranking, vacancies] = await Promise.all([
    loadEvalFile(casesDir, { file: MATCH_EVAL_FILES.cv, schema: resumeParseOutputSchema }),
    loadEvalFile(casesDir, { file: MATCH_EVAL_FILES.ranking, schema: matchRankingSchema }),
    loadVacancyCases(join(casesDir, MATCH_EVAL_FILES.vacancyDir)),
  ]);
  const ranks = rankByFile(
    ranking,
    vacancies.map(({ file }) => file),
  );
  return vacancies.map((vacancy) => ({
    file: vacancy.file,
    rank: ranks.get(vacancy.file) ?? 0,
    input: inputOf(vacancy, cv),
  }));
}
