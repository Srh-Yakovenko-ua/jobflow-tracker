import { Injectable, type OnModuleInit } from '@nestjs/common';

import { AiJobRouter } from '../ai/index.js';
import { MatchSettleService } from './match-settle.service.js';

@Injectable()
export class MatchSubscriber implements OnModuleInit {
  constructor(
    private readonly aiJobs: AiJobRouter,
    private readonly match: MatchSettleService,
  ) {}

  onModuleInit(): void {
    this.aiJobs.subscribe('match', (settled) => this.match.settle(settled));
  }
}
