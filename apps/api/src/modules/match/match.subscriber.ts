import { LIVE_EVENTS } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { AiJobRouter, type SettledAiJob } from '../ai/index.js';
import { LivePublisher } from '../live/index.js';
import { MatchSettleService } from './match-settle.service.js';

@Injectable()
export class MatchSubscriber implements OnModuleInit {
  constructor(
    private readonly aiJobs: AiJobRouter,
    private readonly match: MatchSettleService,
    private readonly live: LivePublisher,
  ) {}

  onModuleInit(): void {
    this.aiJobs.subscribe('match', (settled) => this.settled(settled));
  }

  private async settled(settled: SettledAiJob): Promise<void> {
    const scored = await this.match.settle(settled);
    if (scored === null) {
      return;
    }
    await this.live.publish(scored.userId, {
      type: LIVE_EVENTS.applicationUpdated,
      data: { applicationId: scored.applicationId, fields: ['matchScore'] },
    });
  }
}
