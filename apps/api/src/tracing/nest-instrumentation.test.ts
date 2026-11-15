import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it } from 'vitest';

import { callRoute } from '../test/http.js';
import { recordSpans } from '../test/tracing.js';
import { Nest12Instrumentation } from './nest-instrumentation.js';
import { registerInstrumentationHook, URL_REDACTION } from './tracing.js';

const spans = recordSpans({ processors: [URL_REDACTION] });

@Controller('probe')
class ProbeController {
  @Get()
  handle(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

async function callProbeThroughNest(): Promise<number> {
  const { Test } = await import('@nestjs/testing');
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  await app.init();
  const path = '/probe?code=secret-code&state=secret-state';
  const { status } = await callRoute(app, { method: 'get', path });
  await app.close();
  return status;
}

describe('Nest instrumentation', () => {
  it('records the controller and handler spans of the installed Nest 12, with no query string in the url', async () => {
    registerInstrumentationHook();
    const instrumentation = new Nest12Instrumentation();

    const status = await callProbeThroughNest();
    instrumentation.disable();

    expect(status).toBe(200);
    const [controllerSpan] = await spans.named('ProbeController.handle');
    expect(controllerSpan?.attributes).toMatchObject({
      'nestjs.controller': 'ProbeController',
      'url.full': '/probe',
    });
    expect(await spans.named('handle')).toHaveLength(1);
  });
});
