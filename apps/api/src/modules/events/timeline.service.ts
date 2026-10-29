import {
  type ApplicationTimelineResponse,
  type TimelineRecord,
  timelineRecordSchema,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { APPLICATION_NOT_FOUND, owned } from '../../common/owned.js';
import { TimelineRepository, type TimelineWrite } from './timeline.repository.js';
import { timelineItemsOf } from './timeline-items.js';

export type TimelineEntry = TimelineRecord & TimelineWrite;

@Injectable()
export class TimelineService {
  constructor(private readonly repository: TimelineRepository) {}

  async list(userId: string, applicationId: string): Promise<ApplicationTimelineResponse> {
    const rows = owned(await this.repository.findTimeline(userId, { applicationId }));
    return { items: timelineItemsOf(rows) };
  }

  async record(userId: string, { kind, payload, ...write }: TimelineEntry): Promise<void> {
    const record = timelineRecordSchema.parse({ kind, payload });
    const count = await this.repository.insert(userId, { ...write, record });
    if (count === 0) {
      throw notFound(APPLICATION_NOT_FOUND);
    }
  }
}
