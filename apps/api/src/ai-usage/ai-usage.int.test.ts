import { describe, expect, it } from 'vitest';

import { AI_USAGE_ROWS, FAILED_AI_RESULT, NVIDIA_MODEL } from '../test/ai.js';
import { useTestDatabase } from '../test/database.js';
import { createAiResult, createUser, type NewAiResult } from '../test/factories.js';
import { AiUsageRepository } from './ai-usage.repository.js';

describe('AiUsageRepository.dailyUsage', () => {
  const database = useTestDatabase();

  it("groups every user's results by UTC day, kind, status and model, a failed call on its own line and a 23:30 UTC call on its own day", async () => {
    const [olena, bohdan] = [await createUser(database.prisma), await createUser(database.prisma)];
    const early = new Date('2026-11-04T09:00:00.000Z');
    const late = new Date('2026-11-04T23:30:00.000Z');
    const afterMidnight = new Date('2026-11-05T00:10:00.000Z');
    const morning = new Date('2026-11-05T08:00:00.000Z');
    const results: NewAiResult[] = [
      { userId: olena.id, tokensIn: 100, tokensOut: 40, latencyMs: 1000, updatedAt: early },
      { userId: bohdan.id, tokensIn: 300, tokensOut: 60, latencyMs: 2000, updatedAt: late },
      { userId: olena.id, ...FAILED_AI_RESULT, error: 'ai_invalid_output', updatedAt: late },
      {
        userId: olena.id,
        kind: 'match',
        tokensIn: 50,
        tokensOut: 10,
        latencyMs: 500,
        updatedAt: afterMidnight,
      },
      {
        userId: olena.id,
        model: NVIDIA_MODEL,
        tokensIn: 20,
        tokensOut: 5,
        latencyMs: 701,
        updatedAt: morning,
      },
    ];

    await Promise.all(results.map((result) => createAiResult(database.prisma, result)));

    await expect(new AiUsageRepository(database.prisma).dailyUsage()).resolves.toEqual(
      AI_USAGE_ROWS,
    );
  });
});
