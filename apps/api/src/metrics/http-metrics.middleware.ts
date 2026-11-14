import type { NextFunction, Request, Response } from 'express';
import { Histogram, type Registry } from 'prom-client';
import { z } from 'zod';

import { API_PREFIX } from '../common/api-prefix.middleware.js';
import { METRICS_PATH } from './metrics-endpoint.js';

export const UNMATCHED_ROUTE = 'unmatched';

const UNOBSERVED_PATHS: ReadonlySet<string> = new Set([
  METRICS_PATH,
  `/${API_PREFIX}/events/stream`,
]);

const routeTemplateSchema = z.object({ path: z.string().startsWith('/') });

export type HttpMetricsMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => void;

function routeOf(request: Request): string {
  return routeTemplateSchema.safeParse(request.route).data?.path ?? UNMATCHED_ROUTE;
}

export function httpMetrics(registry: Registry): HttpMetricsMiddleware {
  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Seconds from request to response, by route template, method and status',
    labelNames: ['route', 'method', 'status'] as const,
    registers: [registry],
  });
  return (request, response, next) => {
    if (!UNOBSERVED_PATHS.has(request.path)) {
      const stop = duration.startTimer();
      response.once('finish', () => {
        stop({
          route: routeOf(request),
          method: request.method,
          status: String(response.statusCode),
        });
      });
    }
    next();
  };
}
