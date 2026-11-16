import type { AiKind, AiResultStatus } from '@jobflow/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';

export type AiResultKey = { kind: AiKind; inputHash: string };

export type AiResultFields = AiResultKey & {
  error: string | null;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  now: Date;
};

export type SaveAiResult = AiResultFields & {
  status: AiResultStatus;
  output?: Prisma.InputJsonValue;
};

export type SaveAiFailure = AiResultFields & InTransaction;

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
