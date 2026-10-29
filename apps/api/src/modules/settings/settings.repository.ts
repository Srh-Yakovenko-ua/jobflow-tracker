import { RESPONSE_STAGES, type UpdateUserSettingsInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { withoutUndefined } from '../../common/without-undefined.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { USER_SETTINGS_SELECT, type UserSettingsRow } from '../../prisma/user-settings-row.js';
import { settingsChangedEvent, type SettingsEvent } from './settings.events.js';

type InTransaction = { tx?: Prisma.TransactionClient };

export type SettingsChanges = Omit<UpdateUserSettingsInput, 'quietHoursStart' | 'quietHoursEnd'> & {
  quietHoursStart?: Date;
  quietHoursEnd?: Date;
};

export type UpdateSettings = InTransaction & { data: SettingsChanges };

export type RecordSettingsEvent = InTransaction & { event: SettingsEvent };

export type ResponseTimes = { answered: number; medianDays: number | null };

const NO_RESPONSES: ResponseTimes = { answered: 0, medianDays: null };

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string): Promise<UserSettingsRow | null> {
    return this.prisma.userSettings.findUnique({ where: { userId }, select: USER_SETTINGS_SELECT });
  }

  async update(
    userId: string,
    { data, tx = this.prisma }: UpdateSettings,
  ): Promise<UserSettingsRow | null> {
    const rows = await tx.userSettings.updateManyAndReturn({
      where: { userId },
      data: withoutUndefined(data),
      select: USER_SETTINGS_SELECT,
    });
    return rows[0] ?? null;
  }

  async recordEvent(
    userId: string,
    { event, tx = this.prisma }: RecordSettingsEvent,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: settingsChangedEvent(userId, event.fields),
      select: { id: true },
    });
  }

  async responseTimes(userId: string): Promise<ResponseTimes> {
    const [times = NO_RESPONSES] = await this.prisma.$queryRaw<ResponseTimes[]>`
      WITH answered AS (
        SELECT GREATEST(MIN(e.occurred_at) - a.applied_at, interval '0') AS waited
        FROM applications a
        JOIN stage_events e ON e.application_id = a.id
        LEFT JOIN rejection_reasons r ON r.code = e.reason_code
        WHERE a.user_id = ${userId}::uuid
          AND a.deleted_at IS NULL
          AND a.is_draft = false
          AND a.applied_at IS NOT NULL
          AND e.compensates_event_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM stage_events c
            WHERE c.compensates_event_id = e.id AND c.application_id = e.application_id
          )
          AND e.to_stage = ANY(${[...RESPONSE_STAGES]}::stage[])
          AND r.side IS DISTINCT FROM 'candidate'
        GROUP BY a.id
      )
      SELECT count(*)::int AS answered,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM waited)) / 86400
          AS "medianDays"
      FROM answered`;
    return times;
  }
}
