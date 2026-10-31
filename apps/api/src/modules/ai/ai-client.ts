import {
  type AiCompleteOptions,
  aiCompleteRequestSchemas,
  type AiCompletion,
  aiCompletionSchemas,
  type AiEmbedding,
  aiEmbeddingSchema,
  type AiEmbedRequest,
  aiEmbedRequestSchema,
  type AiKind,
  errorResponseSchema,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { withoutUndefined } from '../../common/without-undefined.js';
import type { Env } from '../../config/env.js';
import { JwtKeys, signServiceToken } from '../auth/index.js';
import { AiServiceError } from './ai-service-error.js';

export type AiCompleteCall = {
  kind: AiKind;
  input: unknown;
  options?: AiCompleteOptions | undefined;
  requestId?: string | undefined;
};

type AiServicePost = { path: string; body: unknown; requestId?: string | undefined };

function allowedBody<Body>(schema: z.ZodType<Body>, value: unknown): Body {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiServiceError({ status: 422, type: 'validation_error', cause: parsed.error });
  }
  return parsed.data;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.ok) {
    return response.json();
  }
  const body: unknown = await response.json().catch(() => undefined);
  const type = errorResponseSchema.safeParse(body).data?.type ?? 'unexpected_response';
  throw new AiServiceError({ status: response.status, type });
}

function toAiServiceError(error: unknown): unknown {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new AiServiceError({ status: 504, type: 'ai_timeout', cause: error });
  }
  return error instanceof TypeError
    ? new AiServiceError({ status: 503, type: 'not_ready', cause: error })
    : error;
}

@Injectable()
export class AiClient {
  private readonly baseUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly keys: JwtKeys,
  ) {
    this.baseUrl = config.get('AI_SERVICE_URL', { infer: true });
  }

  async complete({
    kind,
    input,
    options,
    requestId,
  }: AiCompleteCall): Promise<AiCompletion<AiKind>> {
    const body = allowedBody(aiCompleteRequestSchemas[kind], { ...options, input });
    const completion = await this.post({ path: `/v1/complete/${kind}`, body, requestId });
    return aiCompletionSchemas[kind].parse(completion);
  }

  async embed(request: AiEmbedRequest, requestId?: string): Promise<AiEmbedding> {
    const body = allowedBody(aiEmbedRequestSchema, request);
    return aiEmbeddingSchema.parse(await this.post({ path: '/v1/embed', body, requestId }));
  }

  private async post({ path, body, requestId }: AiServicePost): Promise<unknown> {
    const token = await signServiceToken({
      keys: this.keys,
      scope: 'ai:invoke',
      issuedAt: new Date(),
    });
    const headers = withoutUndefined({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-request-id': requestId,
    });
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEPENDENCY_LIMITS.aiServiceTimeoutMs),
      });
      return await readBody(response);
    } catch (error) {
      throw toAiServiceError(error);
    }
  }
}
