import type { AiEmbedding, ErrorResponse } from '@jobflow/shared';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { VACANCY_COMPLETION, VACANCY_TEXT } from '../../test/ai.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import {
  type FetchCall,
  type FetchReply,
  recordFetch,
  refusedConnection,
  stalled,
  timeOutAtOnce,
} from '../../test/fetch.js';
import { AiClient, type AiCompleteCall } from './ai-client.js';

const AI_SERVICE_URL = 'http://ai.test:8001';

const VACANCY_CALL: AiCompleteCall = {
  kind: 'vacancy_parse',
  input: { text: VACANCY_TEXT },
  requestId: 'req-ai-1',
};

const DOC_04_UNAUTHORIZED = {
  type: 'unauthorized',
  title: 'Unauthorized',
  status: 401,
  detail: 'Missing service token',
  requestId: 'req-ai-1',
} satisfies ErrorResponse;

const aiClient = new AiClient(
  new ConfigService(validateEnv({ ...exampleEnv, AI_SERVICE_URL })),
  testJwtKeys,
);

const jsonBody = (body: RequestInit['body']): unknown =>
  typeof body === 'string' ? JSON.parse(body) : body;

const replyWith = (reply: FetchReply) => recordFetch({ replies: reply, decodeBody: jsonBody });

function bearerOf(call: FetchCall | undefined): string {
  return call?.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
}

const aiServiceError = (status: number, type: string) => ({ name: 'AiServiceError', status, type });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AiClient.complete', () => {
  it('posts to AI_SERVICE_URL with a 60 s ai:invoke service token for jobflow-ai and the request id', async () => {
    const calls = replyWith(() => Response.json(VACANCY_COMPLETION));

    expect(await aiClient.complete(VACANCY_CALL)).toEqual(VACANCY_COMPLETION);

    expect(calls.map(({ url }) => url)).toEqual(['http://ai.test:8001/v1/complete/vacancy_parse']);
    expect(calls[0]?.headers.get('x-request-id')).toBe('req-ai-1');
    const { payload } = await jwtVerify(bearerOf(calls[0]), testJwtKeys.publicKey, {
      audience: 'jobflow-ai',
      issuer: 'jobflow-api',
    });
    expect(payload).toMatchObject({ sub: 'worker', scope: 'ai:invoke', aud: 'jobflow-ai' });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(60);
  });

  it('sends only the fields the vacancy_parse request names', async () => {
    const calls = replyWith(() => Response.json(VACANCY_COMPLETION));

    await aiClient.complete({
      kind: 'vacancy_parse',
      input: { text: VACANCY_TEXT, userId: 'user-1', notes: 'private note' },
      options: { temperature: 0.2 },
    });

    expect(calls.map(({ body }) => body)).toEqual([
      { temperature: 0.2, input: { text: VACANCY_TEXT } },
    ]);
    expect(calls[0]?.headers.has('x-request-id')).toBe(false);
  });

  it('refuses an input the vacancy_parse schema rejects with 422 and calls nothing', async () => {
    const calls = replyWith(() => Response.json(VACANCY_COMPLETION));

    await expect(
      aiClient.complete({ kind: 'vacancy_parse', input: { text: ' ' } }),
    ).rejects.toMatchObject(aiServiceError(422, 'validation_error'));
    expect(calls).toEqual([]);
  });

  it('refuses a 200 whose body is not a vacancy_parse completion', async () => {
    replyWith(() => Response.json({ ...VACANCY_COMPLETION, output: { company: 'Acme' } }));

    await expect(aiClient.complete(VACANCY_CALL)).rejects.toMatchObject({ name: 'ZodError' });
  });

  it.each([
    {
      answer: 'the DOC-04 401 of services/ai',
      reply: () => Response.json(DOC_04_UNAUTHORIZED, { status: 401 }),
      error: aiServiceError(401, 'unauthorized'),
    },
    {
      answer: 'a 502 without a DOC-04 body',
      reply: () => new Response('Bad gateway', { status: 502 }),
      error: aiServiceError(502, 'unexpected_response'),
    },
    {
      answer: 'a refused connection',
      reply: () => Promise.reject(refusedConnection),
      error: aiServiceError(503, 'not_ready'),
    },
  ])('turns $answer into an AiServiceError', async ({ reply, error }) => {
    replyWith(reply);

    await expect(aiClient.complete(VACANCY_CALL)).rejects.toMatchObject(error);
  });

  it('gives up on a services/ai that never answers at the 65 s limit with 504 ai_timeout', async () => {
    const timeout = timeOutAtOnce();
    replyWith(stalled);

    await expect(aiClient.complete(VACANCY_CALL)).rejects.toMatchObject(
      aiServiceError(504, 'ai_timeout'),
    );
    expect(timeout).toHaveBeenCalledWith(65_000);
  });
});

describe('AiClient.embed', () => {
  it('posts the texts to /v1/embed and answers the parsed embedding', async () => {
    const embedding: AiEmbedding = {
      vectors: [[0.25, -0.5]],
      model: 'fake',
      tokensIn: 3,
      latencyMs: 4,
    };
    const calls = replyWith(() => Response.json(embedding));

    expect(await aiClient.embed({ texts: ['Node.js'], inputType: 'query' })).toEqual(embedding);

    expect(calls.map(({ url, body }) => [url, body])).toEqual([
      ['http://ai.test:8001/v1/embed', { texts: ['Node.js'], inputType: 'query' }],
    ]);
  });
});
