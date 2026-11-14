import { AI_KINDS } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Gauge } from 'prom-client';

import { pricePerMillionOf } from '../../ai-usage/ai-cost.js';
import type { Env } from '../../config/env.js';
import { MetricsRegistry } from '../../metrics/metrics-registry.js';
import { AiJobRouter, type SettledAiJob } from './ai-job-router.js';

@Injectable()
export class AiMetricsSubscriber implements OnModuleInit {
  private readonly jobs: Counter<'kind' | 'status' | 'error_type'>;

  constructor(
    private readonly router: AiJobRouter,
    metrics: MetricsRegistry,
    config: ConfigService<Env, true>,
  ) {
    const registers = [metrics.registry];
    this.jobs = new Counter({
      name: 'jobflow_ai_jobs_total',
      help: 'Settled AI jobs by kind, status and failure type',
      labelNames: ['kind', 'status', 'error_type'] as const,
      registers,
    });
    const price = new Gauge({
      name: 'jobflow_ai_price_usd_per_million_tokens',
      help: 'Configured USD price per million AI tokens, in and out',
      labelNames: ['direction'] as const,
      registers,
    });
    const { tokensIn, tokensOut } = pricePerMillionOf(config);
    price.set({ direction: 'in' }, tokensIn);
    price.set({ direction: 'out' }, tokensOut);
  }

  onModuleInit(): void {
    for (const kind of AI_KINDS) {
      this.router.subscribe(kind, (settled) => this.count(settled));
    }
  }

  private count(settled: SettledAiJob): Promise<void> {
    const errorType = settled.status === 'failed' ? settled.errorType : '';
    this.jobs.inc({ kind: settled.job.kind, status: settled.status, error_type: errorType });
    return Promise.resolve();
  }
}
