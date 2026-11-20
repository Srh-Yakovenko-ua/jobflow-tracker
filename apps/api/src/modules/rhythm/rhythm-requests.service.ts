import { weekStartOf } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { subWeeks } from 'date-fns';

import { Clock } from '../../common/clock.js';
import { requestEach, type RequestTotals } from '../../common/request-each.js';
import { SettingsService } from '../settings/index.js';
import { RhythmRepository } from './rhythm.repository.js';

@Injectable()
export class RhythmRequestsService {
  private readonly logger = new Logger(RhythmRequestsService.name);

  constructor(
    private readonly repository: RhythmRepository,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  requestWeekClose(userIds: string[]): Promise<RequestTotals> {
    const now = this.clock.now();
    return requestEach(userIds, {
      request: (userId) => this.requestFor(userId, now),
      logger: this.logger,
      labels: { failed: 'week close request failed', done: 'rhythm week close requested' },
    });
  }

  private async requestFor(userId: string, now: Date): Promise<boolean> {
    const settings = await this.settings.find(userId);
    if (settings === null) return false;
    const weekStart = weekStartOf(settings, subWeeks(now, 1));
    await this.repository.recordWeekClosed(userId, { closed: { weekStart } });
    return true;
  }
}
