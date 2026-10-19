import type { Request, Response } from 'express';
import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';

import { readRequestId } from './request-id.middleware.js';

const QUIET_PATHS = new Set(['/api/v1/health']);

const QUIET_METHODS = new Set(['GET', 'HEAD']);

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

const HTTP_LOG_OPTIONS: Options<Request, Response> = {
  genReqId: (req) => readRequestId(req),
  customProps: (req) => ({ requestId: readRequestId(req) }),
  redact: REDACTED_PATHS,
  autoLogging: {
    ignore: (req) => QUIET_METHODS.has(req.method) && QUIET_PATHS.has(req.originalUrl),
  },
};

export function loggerParams(destination?: DestinationStream): Params<Request, Response> {
  return {
    pinoHttp: destination === undefined ? HTTP_LOG_OPTIONS : [HTTP_LOG_OPTIONS, destination],
  };
}
