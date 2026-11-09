import type { AiKind } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { HandlerRouter, type RoutedHandler } from '../../common/handler-router.js';
import type { AiCompleteJob } from './ai.jobs.js';

export type SettledAiJob = { job: AiCompleteJob } & (
  { status: 'done'; output: unknown } | { status: 'failed'; errorType: string }
);

export type SettledAiJobHandler = RoutedHandler<SettledAiJob>;

@Injectable()
export class AiJobRouter extends HandlerRouter<AiKind, SettledAiJob> {
  async route(settled: SettledAiJob): Promise<void> {
    await this.deliver(settled.job.kind, settled);
  }
}
