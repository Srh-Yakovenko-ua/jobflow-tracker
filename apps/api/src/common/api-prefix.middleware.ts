import type { NextFunction, Request, Response } from 'express';

import { notFound } from './app-error.js';

export const API_PREFIX = 'api/v1';

export const JWKS_PATH = '.well-known/jwks.json';

export function rejectOutsidePrefix(req: Request, _res: Response, next: NextFunction): void {
  const inside =
    req.path === `/${API_PREFIX}` ||
    req.path.startsWith(`/${API_PREFIX}/`) ||
    req.path === `/${JWKS_PATH}`;
  next(inside ? undefined : notFound());
}
