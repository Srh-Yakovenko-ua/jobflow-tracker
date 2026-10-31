export type AiServiceFailure = { status: number; type: string; cause?: unknown };

export class AiServiceError extends Error {
  readonly status: number;

  readonly type: string;

  constructor({ status, type, cause }: AiServiceFailure) {
    super(`AI call failed: ${String(status)} ${type}`, { cause });
    this.name = 'AiServiceError';
    this.status = status;
    this.type = type;
  }
}
