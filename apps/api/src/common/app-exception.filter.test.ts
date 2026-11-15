import { Controller, Get } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { configModule } from '../config/app-config.js';
import { APP_OPTIONS, configureApp } from '../configure-app.js';
import { ErrorReporter } from '../error-tracking/error-reporter.js';
import { ErrorTrackingModule } from '../error-tracking/error-tracking.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { RecordingErrorReporter } from '../test/error-reporter.js';
import { memoryLog } from '../test/memory-log.js';
import { notFound, validation } from './app-error.js';
import { AppExceptionFilter } from './app-exception.filter.js';
import { loggerParams } from './logger.js';

const CRASH = new Error('the reply parser read past the end of the buffer');

@Controller('probe')
class FailingController {
  @Get('crash')
  crash(): never {
    throw CRASH;
  }

  @Get('missing')
  missing(): never {
    throw notFound('Application not found');
  }

  @Get('invalid')
  invalid(): never {
    throw validation([{ path: 'salaryMin', message: 'Too small' }]);
  }
}

const log = memoryLog();

describe('AppExceptionFilter error reports', () => {
  const reporter = new RecordingErrorReporter();
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        configModule,
        LoggerModule.forRoot(loggerParams(log.sink)),
        MetricsModule,
        ErrorTrackingModule,
      ],
      controllers: [FailingController],
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
    })
      .overrideProvider(ErrorReporter)
      .useValue(reporter)
      .compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
    await app.init();
  });

  beforeEach(() => {
    reporter.reports.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a 500 once, tagged with the requestId the client got', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/crash')
      .set('x-request-id', 'crash-5f3a9c0e');

    expect(response.status).toBe(500);
    expect(reporter.reports).toEqual([{ exception: CRASH, tags: { requestId: 'crash-5f3a9c0e' } }]);
  });

  it.each([
    { status: 404, path: 'missing' },
    { status: 422, path: 'invalid' },
  ])('reports nothing for a $status', async ({ status, path }) => {
    const response = await request(app.getHttpServer()).get(`/api/v1/probe/${path}`);

    expect(response.status).toBe(status);
    expect(reporter.reports).toEqual([]);
  });
});
