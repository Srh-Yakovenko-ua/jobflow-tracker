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
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { fetchFailureOf, refusalTypeOf } from '../../common/service-call-error.js';
import { withoutUndefined } from '../../common/without-undefined.js';
import type { Env } from '../../config/env.js';
import { JwtKeys, signServiceToken } from '../auth/index.js';
import { AI_SERVICE_ERRORS, AiServiceError, type AiServiceErrorType } from './ai-service-error.js';

export type AiCompleteCall = {
  kind: AiKind;
  input: unknown;
  options?: AiCompleteOptions | undefined;
  requestId?: string | undefined;
};

type AiServicePost = { path: string; body: unknown; requestId?: string | undefined };

type Checked = {
  value: unknown;
  refusal: AiServiceErrorType;
};

function checked<Body>(schema: z.ZodType<Body>, { value, refusal }: Checked): Body {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiServiceError({ status: 422, type: refusal, cause: parsed.error });
  }
  return parsed.data;
}

function allowedBody<Body>(schema: z.ZodType<Body>, value: unknown): Body {
  return checked(schema, { value, refusal: AI_SERVICE_ERRORS.validation });
}

function unparsedBody(error: unknown): undefined {
  if (error instanceof SyntaxError) {
    return undefined;
  }
  throw error;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.ok) {
    return response.json().catch(unparsedBody);
  }
  throw new AiServiceError({ status: response.status, type: await refusalTypeOf(response) });
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
    const requestSchema: z.ZodType = aiCompleteRequestSchemas[kind];
    const body = allowedBody(requestSchema, { ...options, input });
    const completion = await this.post({ path: `/v1/complete/${kind}`, body, requestId });
    const schema: z.ZodType<AiCompletion<AiKind>> = aiCompletionSchemas[kind];
    return checked(schema, {
      value: completion,
      refusal: AI_SERVICE_ERRORS.invalidOutput,
    });
  }

  async embed(request: AiEmbedRequest, requestId?: string): Promise<AiEmbedding> {
    const body = allowedBody(aiEmbedRequestSchema, request);
    const embedding = await this.post({ path: '/v1/embed', body, requestId });
    return checked(aiEmbeddingSchema, {
      value: embedding,
      refusal: AI_SERVICE_ERRORS.invalidOutput,
    });
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
      throw fetchFailureOf(error, {
        timeoutType: AI_SERVICE_ERRORS.timeout,
        ErrorClass: AiServiceError,
      });
    }
  }
}
