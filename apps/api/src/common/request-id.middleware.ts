import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function pickRequestId(incoming: string | undefined): string {
  return incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = pickRequestId(req.get(REQUEST_ID_HEADER));
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

export function readRequestId(req: IncomingMessage): string {
  return typeof req.id === 'string' ? req.id : randomUUID();
}
