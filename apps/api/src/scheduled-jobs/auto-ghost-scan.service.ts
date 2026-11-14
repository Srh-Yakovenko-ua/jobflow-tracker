import { type AutoGhostedNotificationPayload, silenceItemOf } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { milliseconds, subMilliseconds } from 'date-fns';

import { AppError } from '../common/app-error.js';
import { Clock } from '../common/clock.js';
import { StageTransitionService } from '../modules/applications/index.js';
import { NotificationsService } from '../modules/notifications/index.js';
import {
  type AutoGhostCandidate,
  type GhostCandidate,
  ScheduledJobsRepository,
} from './scheduled-jobs.repository.js';

export type AutoGhostTotals = { users: number; moved: number; skipped: number };

type UserGhostRun = AutoGhostCandidate & { now: Date };

const SKIPPED_MOVE_STATUSES: ReadonlySet<number> = new Set([404, 409]);

const isSkippedMove = (error: unknown) =>
  error instanceof AppError && SKIPPED_MOVE_STATUSES.has(error.status);

@Injectable()
export class AutoGhostScanService {
  private readonly logger = new Logger(AutoGhostScanService.name);

  constructor(
    private readonly repository: ScheduledJobsRepository,
    private readonly clock: Clock,
    private readonly stageTransitions: StageTransitionService,
    private readonly notifications: NotificationsService,
  ) {}

  async scan(): Promise<AutoGhostTotals> {
    const now = this.clock.now();
    const candidates = await this.repository.autoGhostCandidates();
    const totals: AutoGhostTotals = { users: candidates.length, moved: 0, skipped: 0 };
    for (const candidate of candidates) {
      const { moved, skipped } = await this.ghostSilentOf({ ...candidate, now });
      totals.moved += moved;
      totals.skipped += skipped;
    }
    this.logger.log(totals, 'auto ghost scan done');
    return totals;
  }

  private async ghostSilentOf({ userId, autoGhostDays, now }: UserGhostRun) {
    const cutoff = subMilliseconds(now, milliseconds({ days: autoGhostDays }));
    const rows = await this.repository.ghostCandidates(userId, cutoff);
    const ghosted: AutoGhostedNotificationPayload = { items: [], autoGhostDays };
    try {
      for (const row of rows) {
        if (await this.ghost(userId, row)) {
          ghosted.items.push(silenceItemOf(row, now));
        }
      }
    } finally {
      await this.notifyGhosted(userId, ghosted);
    }
    return { moved: ghosted.items.length, skipped: rows.length - ghosted.items.length };
  }

  private async ghost(userId: string, { id, currentStage }: GhostCandidate): Promise<boolean> {
    const input = {
      fromStage: currentStage,
      toStage: 'ghosted',
      reasonCode: 'silence_timeout',
    } as const;
    try {
      await this.stageTransitions.move(userId, { id, input });
      return true;
    } catch (error) {
      if (isSkippedMove(error)) {
        return false;
      }
      throw error;
    }
  }

  private async notifyGhosted(
    userId: string,
    payload: AutoGhostedNotificationPayload,
  ): Promise<void> {
    if (payload.items.length > 0) {
      await this.notifications.record(userId, { type: 'auto_ghosted', payload });
    }
  }
}
