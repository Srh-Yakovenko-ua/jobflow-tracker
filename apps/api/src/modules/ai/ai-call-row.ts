import type { AiKind, AiResultStatus } from '@jobflow/shared';

export type AiCallRecord = {
  kind: AiKind;
  status: AiResultStatus;
  errorType: string | null;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  now: Date;
};

export function callRow(userId: string, call: AiCallRecord) {
  const { kind, status, errorType, model, tokensIn, tokensOut, latencyMs, now } = call;
  return { userId, kind, status, errorType, model, tokensIn, tokensOut, latencyMs, createdAt: now };
}
