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

export type AiCompleteCall<Kind extends AiKind = AiKind> = {
  kind: Kind;
  input: unknown;
  options?: AiCompleteOptions | undefined;
  requestId?: string | undefined;
};

const COMPLETION_SCHEMAS: { [Kind in AiKind]: z.ZodType<AiCompletion<Kind>> } = aiCompletionSchemas;

type AiServicePost = { path: string; body: unknown; requestId?: string | undefined };

type Checked = {
  value: unknown;
  refusal: AiServiceErrorType;
  reachedService?: false;
};

function checked<Body>(schema: z.ZodType<Body>, { value, refusal, ...reach }: Checked): Body {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiServiceError({ status: 422, type: refusal, cause: parsed.error, ...reach });
  }
  return parsed.data;
}

function allowedBody<Body>(schema: z.ZodType<Body>, value: unknown): Body {
  return checked(schema, { value, refusal: AI_SERVICE_ERRORS.validation, reachedService: false });
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

function isRefusedConnection(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  const { cause } = error;
  return (
    typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ECONNREFUSED'
  );
}

function postFailureOf(error: unknown): unknown {
  if (isRefusedConnection(error)) {
    const type = AI_SERVICE_ERRORS.notReady;
    return new AiServiceError({ status: 503, type, cause: error, reachedService: false });
  }
  return fetchFailureOf(error, {
    timeoutType: AI_SERVICE_ERRORS.timeout,
    ErrorClass: AiServiceError,
  });
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

  async complete<Kind extends AiKind>({
    kind,
    input,
    options,
    requestId,
  }: AiCompleteCall<Kind>): Promise<AiCompletion<Kind>> {
    const requestSchema: z.ZodType = aiCompleteRequestSchemas[kind];
    const body = allowedBody(requestSchema, { ...options, input });
    const completion = await this.post({ path: `/v1/complete/${kind}`, body, requestId });
    return checked(COMPLETION_SCHEMAS[kind], {
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

  private async serviceToken(): Promise<string> {
    try {
      return await signServiceToken({ keys: this.keys, scope: 'ai:invoke', issuedAt: new Date() });
    } catch (cause) {
      const type = AI_SERVICE_ERRORS.internal;
      throw new AiServiceError({ status: 500, type, cause, reachedService: false });
    }
  }

  private async post({ path, body, requestId }: AiServicePost): Promise<unknown> {
    const token = await this.serviceToken();
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
      throw postFailureOf(error);
    }
  }
}
