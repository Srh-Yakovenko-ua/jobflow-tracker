import { Controller, Get, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { configModule } from '../config/app-config.js';
import { APP_OPTIONS, configureApp } from '../configure-app.js';
import { memoryLog } from '../test/memory-log.js';
import { loggerParams } from './logger.js';

@Controller('probe')
class ProbeController {
  private readonly logger = new Logger(ProbeController.name);

  @Get()
  probe(): { handled: true } {
    this.logger.log('probe handled');
    return { handled: true };
  }
}

const log = memoryLog();

describe('request logs', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [configModule, LoggerModule.forRoot(loggerParams(log.sink))],
      controllers: [ProbeController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
    await app.init();
  });

  beforeEach(() => {
    log.lines.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('writes every line of a request as JSON carrying its requestId', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe').set('x-request-id', 'log-check');

    const requestLines = log.parsed();
    expect(requestLines.map((line) => line.msg)).toEqual(['probe handled', 'request completed']);
    expect(requestLines.every((line) => line.requestId === 'log-check')).toBe(true);
  });

  it('redacts the authorization and cookie headers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/probe')
      .set('authorization', 'Bearer secret-access-token')
      .set('cookie', 'refresh=secret-refresh-token');

    expect(log.lines.join('\n')).not.toContain('secret-');
  });

  it('writes no request line for the health check', async () => {
    await request(app.getHttpServer()).get('/api/v1/health');

    expect(log.lines).toEqual([]);
  });

  it('logs a request to the health path that is not a GET or HEAD', async () => {
    await request(app.getHttpServer()).post('/api/v1/health');

    expect(log.parsed()).toHaveLength(1);
  });
});
