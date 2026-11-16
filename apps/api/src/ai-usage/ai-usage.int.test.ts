import { describe, expect, it } from 'vitest';

import { AiRepository } from '../modules/ai/index.js';
import { AI_USAGE_ROWS, NVIDIA_MODEL } from '../test/ai.js';
import { useTestDatabase } from '../test/database.js';
import { createAiCall, createAiResult, createUser, type NewAiCall } from '../test/factories.js';
import { AiUsageRepository } from './ai-usage.repository.js';

describe('AiUsageRepository.dailyUsage', () => {
  const database = useTestDatabase();

  async function seedCalls(): Promise<string> {
    const [olena, bohdan] = [await createUser(database.prisma), await createUser(database.prisma)];
    const early = new Date('2026-11-04T09:00:00.000Z');
    const late = new Date('2026-11-04T23:30:00.000Z');
    const afterMidnight = new Date('2026-11-05T00:10:00.000Z');
    const morning = new Date('2026-11-05T08:00:00.000Z');
    const calls: NewAiCall[] = [
      { userId: olena.id, tokensIn: 100, tokensOut: 40, latencyMs: 1000, createdAt: early },
      { userId: bohdan.id, tokensIn: 300, tokensOut: 60, latencyMs: 2000, createdAt: late },
      {
        userId: olena.id,
        status: 'failed',
        errorType: 'ai_invalid_output',
        model: 'fake',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 0,
        createdAt: late,
      },
      {
        userId: olena.id,
        kind: 'match',
        tokensIn: 50,
        tokensOut: 10,
        latencyMs: 500,
        createdAt: afterMidnight,
      },
      {
        userId: olena.id,
        model: NVIDIA_MODEL,
        tokensIn: 20,
        tokensOut: 5,
        latencyMs: 701,
        createdAt: morning,
      },
    ];
    await Promise.all(calls.map((call) => createAiCall(database.prisma, call)));
    return olena.id;
  }

  it("groups every user's calls by UTC day, kind, status and model, a failed call on its own line and a 23:30 UTC call on its own day", async () => {
    await seedCalls();

    await expect(new AiUsageRepository(database.prisma).dailyUsage()).resolves.toEqual(
      AI_USAGE_ROWS,
    );
  });

  it('shows the same rows after a user deletes all AI results', async () => {
    const olenaId = await seedCalls();
    await createAiResult(database.prisma, { userId: olenaId });
    await createAiResult(database.prisma, { userId: olenaId, kind: 'match' });
    const repository = new AiUsageRepository(database.prisma);

    const before = await repository.dailyUsage();
    await new AiRepository(database.prisma).deleteResults(olenaId);
    const after = await repository.dailyUsage();

    expect(before).toEqual(AI_USAGE_ROWS);
    expect(after).toEqual(AI_USAGE_ROWS);
  });
});
