import type { IncomingMessage, ServerResponse } from 'node:http';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Registry } from 'prom-client';

import { MetricsRegistry } from './metrics-registry.js';

export const METRICS_PATH = '/metrics';

export type MetricsHandler = (request: IncomingMessage, response: ServerResponse) => void;

export function answerNotFound(response: ServerResponse): void {
  response.writeHead(404).end();
}

export function metricsHandler(registry: Registry): MetricsHandler {
  return (request, response) => {
    if (request.method !== 'GET') {
      answerNotFound(response);
      return;
    }
    void registry.metrics().then(
      (body) => {
        response.writeHead(200, { 'content-type': registry.contentType }).end(body);
      },
      () => {
        response.writeHead(500).end();
      },
    );
  };
}

export function mountMetrics(app: NestExpressApplication): void {
  app.use(METRICS_PATH, metricsHandler(app.get(MetricsRegistry).registry));
}
