import type { SilenceWindow } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { silenceWindowWhere } from '../../prisma/silence-window-where.js';

export const SILENCE_MARK_SELECT = {
  lastEventAt: true,
  stageEvents: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { createdAt: true },
  },
} satisfies Prisma.ApplicationSelect;

const SILENT_APPLICATION_SELECT = {
  ...SILENCE_MARK_SELECT,
  id: true,
  company: true,
  currentStage: true,
  reminders: {
    where: { type: 'followup' },
    orderBy: [{ dueAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { dueAt: true },
  },
} satisfies Prisma.ApplicationSelect;

export type SilenceMarkRow = Prisma.ApplicationGetPayload<{ select: typeof SILENCE_MARK_SELECT }>;

export type SilentApplicationRow = Prisma.ApplicationGetPayload<{
  select: typeof SILENT_APPLICATION_SELECT;
}>;

export type SilenceWindows = { windows: readonly SilenceWindow[] };

@Injectable()
export class SilenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSilentApplications(
    userId: string,
    { windows }: SilenceWindows,
  ): Promise<SilentApplicationRow[]> {
    return this.prisma.application.findMany({
      where: { userId, deletedAt: null, isDraft: false, OR: windows.map(silenceWindowWhere) },
      orderBy: [{ lastEventAt: 'asc' }, { id: 'asc' }],
      select: SILENT_APPLICATION_SELECT,
    });
  }
}
