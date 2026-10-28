import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';

import { API_PREFIX } from '../../common/api-prefix.middleware.js';

export type HttpOnlyCookieSpec = {
  name: string;
  sameSite: 'strict' | 'lax';
  path: string;
  maxAgeMs: number;
};

export type HttpOnlyCookie = {
  set: (res: Response, value: string) => void;
  read: (req: Request) => string | undefined;
  clear: (res: Response) => void;
};

export function httpOnlyCookie({
  name,
  sameSite,
  path,
  maxAgeMs,
}: HttpOnlyCookieSpec): HttpOnlyCookie {
  const scope: CookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite,
    path: `/${API_PREFIX}${path}`,
  };
  return {
    set: (res, value) => {
      res.cookie(name, value, { ...scope, maxAge: maxAgeMs });
    },
    read: (req) => parseCookie(req.headers.cookie ?? '')[name],
    clear: (res) => {
      res.clearCookie(name, scope);
    },
  };
}
