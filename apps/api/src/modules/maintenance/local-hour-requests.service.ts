import { Injectable } from '@nestjs/common';

import type { RequestTotals } from '../../common/request-each.js';
import { ScheduledJobsService } from '../../scheduled-jobs/scheduled-jobs.service.js';
import { RhythmRequestsService } from '../rhythm/index.js';
import { SummaryRequestsService } from '../summaries/index.js';

@Injectable()
export class LocalHourRequestsService {
  constructor(
    private readonly scheduledJobs: ScheduledJobsService,
    private readonly summaries: SummaryRequestsService,
    private readonly rhythm: RhythmRequestsService,
  ) {}

  async monthlySummary(): Promise<RequestTotals> {
    return this.summaries.requestScheduledFor(await this.scheduledJobs.monthlySummaryUsers());
  }

  async weekClose(): Promise<RequestTotals> {
    return this.rhythm.requestWeekClose(await this.scheduledJobs.weekCloseUsers());
  }
}
