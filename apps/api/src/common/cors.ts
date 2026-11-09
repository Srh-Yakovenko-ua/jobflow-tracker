import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';

import { API_PREFIX } from './api-prefix.middleware.js';
import { IDEMPOTENCY_HEADER } from './idempotency/idempotency-request.js';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';

export const BOOKMARKLET_PATH = `/${API_PREFIX}/capture/bookmarklet`;

const EXPOSED_HEADERS = [REQUEST_ID_HEADER, 'Retry-After'];

const BOOKMARKLET_CORS: CorsOptions = {
  origin: '*',
  credentials: false,
  methods: ['POST'],
  allowedHeaders: ['Authorization', 'Content-Type', IDEMPOTENCY_HEADER],
  exposedHeaders: EXPOSED_HEADERS,
};

export function corsFor(webOrigin: string): CorsOptionsDelegate<Request> {
  const webCors: CorsOptions = {
    origin: [webOrigin],
    credentials: true,
    exposedHeaders: EXPOSED_HEADERS,
  };
  return (req, callback) => {
    callback(null, req.path === BOOKMARKLET_PATH ? BOOKMARKLET_CORS : webCors);
  };
}
