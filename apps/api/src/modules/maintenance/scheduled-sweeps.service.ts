import { Injectable } from '@nestjs/common';

import { AiJobsSweepService } from '../../scheduled-jobs/ai-jobs-sweep.service.js';
import {
  AutoGhostScanService,
  type AutoGhostTotals,
} from '../../scheduled-jobs/auto-ghost-scan.service.js';

@Injectable()
export class ScheduledSweepsService {
  constructor(
    private readonly autoGhost: AutoGhostScanService,
    private readonly aiJobs: AiJobsSweepService,
  ) {}

  autoGhostScan(): Promise<AutoGhostTotals> {
    return this.autoGhost.scan();
  }

  async aiJobsSweep(): Promise<void> {
    await this.aiJobs.sweepStaleAiJobs();
    await this.aiJobs.redeliverUnsettledAiFailures();
  }
}
