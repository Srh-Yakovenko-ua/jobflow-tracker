import { createHash } from 'node:crypto';

import type { Request, Response } from 'express';
import type { Params } from 'nestjs-pino';
import type { DestinationStream, SerializedRequest } from 'pino';
import type { Options } from 'pino-http';

import { traceFields } from '../tracing/trace-context.js';
import { readRequestId } from './request-id.middleware.js';

export const QUIET_PATHS: ReadonlySet<string> = new Set(['/api/v1/health']);

const QUIET_METHODS = new Set(['GET', 'HEAD']);

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.query.code',
  'req.query.state',
  'req.query.ticket',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.refreshToken',
  'password',
  'passwordHash',
  'refreshToken',
  'accessToken',
  'token',
  'captureToken',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
  '*.token',
  '*.captureToken',
];

export const withoutQuery = (url: string): string => url.split('?', 1)[0] ?? url;

const withoutQueryString = (req: SerializedRequest): SerializedRequest => ({
  ...req,
  url: withoutQuery(req.url),
});

const userHashOf = (userId: string): string =>
  createHash('sha256').update(userId).digest('hex').slice(0, 16);

const withHashedUser = (line: Record<string, unknown>): Record<string, unknown> =>
  typeof line.userId === 'string' ? { ...line, userId: userHashOf(line.userId) } : line;

type LoggedError = { type: string; code?: string; stack: string };

const errorOf = (value: unknown): Error | undefined => {
  if (value instanceof Error) return value;
  const raw: unknown =
    typeof value === 'object' && value !== null ? Reflect.get(value, 'raw') : undefined;
  return raw instanceof Error ? raw : undefined;
};

const stackFramesOf = (stack = ''): string =>
  stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .join('\n');

function loggedErrorOf(value: unknown): unknown {
  const error = errorOf(value);
  if (error === undefined) return value;
  const code: unknown = Reflect.get(error, 'code');
  return {
    type: error.name,
    ...(typeof code === 'string' ? { code } : {}),
    stack: stackFramesOf(error.stack),
  } satisfies LoggedError;
}

const HTTP_LOG_OPTIONS: Options<Request, Response> = {
  genReqId: (req) => readRequestId(req),
  customProps: (req) => ({
    requestId: readRequestId(req),
    ...(req.user ? { userId: userHashOf(req.user.id) } : {}),
  }),
  formatters: { log: withHashedUser },
  mixin: traceFields,
  serializers: { req: withoutQueryString, err: loggedErrorOf },
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
