import { createServer, type Server } from 'node:http';

import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { answerNotFound, METRICS_PATH, metricsHandler } from './metrics-endpoint.js';
import { MetricsRegistry } from './metrics-registry.js';

@Injectable()
export class WorkerMetricsServer implements OnApplicationBootstrap, OnModuleDestroy {
  readonly server: Server;

  constructor(
    private readonly config: ConfigService<Env, true>,
    metrics: MetricsRegistry,
  ) {
    const answerMetrics = metricsHandler(metrics.registry);
    this.server = createServer((request, response) => {
      if (request.url === METRICS_PATH) {
        answerMetrics(request, response);
        return;
      }
      answerNotFound(response);
    });
  }

  onApplicationBootstrap(): Promise<void> {
    const port = this.config.get('WORKER_METRICS_PORT', { infer: true });
    const host = this.config.get('HOST', { infer: true });
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, resolve);
    });
  }

  onModuleDestroy(): Promise<void> {
    if (!this.server.listening) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      });
      this.server.closeAllConnections();
    });
  }
}
