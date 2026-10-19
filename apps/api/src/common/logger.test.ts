import { Controller, Get, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { configModule } from '../config/app-config.js';
import { APP_OPTIONS, configureApp } from '../configure-app.js';
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

const lines: string[] = [];

const memorySink = {
  write: (line: string) => {
    lines.push(line);
  },
};

function parsedLines(): Record<string, unknown>[] {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('request logs', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [configModule, LoggerModule.forRoot(loggerParams(memorySink))],
      controllers: [ProbeController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
    await app.init();
  });

  beforeEach(() => {
    lines.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('writes every line of a request as JSON carrying its requestId', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe').set('x-request-id', 'log-check');

    const requestLines = parsedLines();
    expect(requestLines.map((line) => line.msg)).toEqual(['probe handled', 'request completed']);
    expect(requestLines.every((line) => line.requestId === 'log-check')).toBe(true);
  });

  it('redacts the authorization and cookie headers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/probe')
      .set('authorization', 'Bearer secret-access-token')
      .set('cookie', 'refresh=secret-refresh-token');

    expect(lines.join('\n')).not.toContain('secret-');
  });

  it('writes no request line for the health check', async () => {
    await request(app.getHttpServer()).get('/api/v1/health');

    expect(lines).toEqual([]);
  });
});
