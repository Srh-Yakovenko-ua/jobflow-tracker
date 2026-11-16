import type { SaveAiResult } from './ai.repository.js';

export function resultRow(userId: string, { now, ...result }: SaveAiResult) {
  return { userId, ...result, updatedAt: now };
}

export function resultChange({ now, tokensIn, tokensOut, ...result }: SaveAiResult) {
  return {
    ...result,
    updatedAt: now,
    tokensIn: { increment: tokensIn },
    tokensOut: { increment: tokensOut },
  };
}
