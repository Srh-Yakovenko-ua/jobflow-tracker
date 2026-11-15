import { once } from 'node:events';
import { createServer, type IncomingHttpHeaders } from 'node:http';

import { ConfigService } from '@nestjs/config';
import { SpanKind } from '@opentelemetry/api';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { VACANCY_CALL, VACANCY_COMPLETION } from '../../test/ai.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import { listenLocally } from '../../test/tcp-proxy.js';
import { insideSpan, recordSpans, traceparentOf } from '../../test/tracing.js';
import { AiClient } from './ai-client.js';

describe('AiClient inside a traced request', () => {
  const spans = recordSpans();
  const instrumentation = new UndiciInstrumentation();
  const received: IncomingHttpHeaders[] = [];
  const aiService = createServer((request, response) => {
    received.push(request.headers);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(VACANCY_COMPLETION));
  });
  let aiClient: AiClient;

  beforeAll(async () => {
    const port = await listenLocally(aiService);
    const AI_SERVICE_URL = `http://127.0.0.1:${String(port)}`;
    aiClient = new AiClient(
      new ConfigService(validateEnv({ ...exampleEnv, AI_SERVICE_URL })),
      testJwtKeys,
    );
  });

  afterAll(async () => {
    instrumentation.disable();
    aiService.closeAllConnections();
    aiService.close();
    await once(aiService, 'close');
  });

  it('sends services/ai a traceparent in the trace of the active span', async () => {
    const { traceId } = await insideSpan(async (span) => {
      expect(await aiClient.complete(VACANCY_CALL)).toEqual(VACANCY_COMPLETION);
      return span.spanContext();
    });

    const calls = (await spans.finished()).filter(({ kind }) => kind === SpanKind.CLIENT);
    const sent = calls.map((call) => traceparentOf({ traceId, spanId: call.spanContext().spanId }));
    expect(sent).toHaveLength(1);
    expect(received.map(({ traceparent }) => traceparent)).toEqual(sent);
  });
});
