import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { EFFECTIVE_STAGE_EVENTS } from '../../prisma/effective-stage-events.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const OLDEST_FIRST: [{ createdAt: 'asc' }, { id: 'asc' }] = [{ createdAt: 'asc' }, { id: 'asc' }];

const EXPORT_APPLICATION_SELECT = {
  id: true,
  company: true,
  position: true,
  source: true,
  url: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  stack: true,
  location: true,
  workMode: true,
  currentStage: true,
  matchScore: true,
  appliedAt: true,
  createdAt: true,
  search: { select: { title: true } },
  stageEvents: {
    where: EFFECTIVE_STAGE_EVENTS.where,
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: {
      fromStage: true,
      toStage: true,
      reasonCode: true,
      comment: true,
      occurredAt: true,
      reason: { select: { labelUk: true } },
    },
  },
  contacts: {
    orderBy: OLDEST_FIRST,
    select: { name: true, role: true, email: true, telegram: true, phone: true, note: true },
  },
  notes: { orderBy: OLDEST_FIRST, select: { body: true, createdAt: true } },
} satisfies Prisma.ApplicationSelect;

const EXPORT_RESUME_VERSION_SELECT = {
  id: true,
  resumeId: true,
  number: true,
  title: true,
  filename: true,
  mime: true,
  sizeBytes: true,
  note: true,
  isArchived: true,
  uploadedAt: true,
} satisfies Prisma.ResumeVersionSelect;

export type ExportApplicationRow = Prisma.ApplicationGetPayload<{
  select: typeof EXPORT_APPLICATION_SELECT;
}>;

export type ExportResumeVersionRow = Prisma.ResumeVersionGetPayload<{
  select: typeof EXPORT_RESUME_VERSION_SELECT;
}>;

export type ExportData = {
  applications: ExportApplicationRow[];
  resumeVersions: ExportResumeVersionRow[];
};

@Injectable()
export class AccountExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExportData(userId: string): Promise<ExportData | null> {
    const [users, applications, resumeVersions] = await Promise.all([
      this.prisma.user.count({ where: { id: userId } }),
      this.prisma.application.findMany({
        where: { userId, deletedAt: null, isDraft: false },
        orderBy: OLDEST_FIRST,
        select: EXPORT_APPLICATION_SELECT,
      }),
      this.prisma.resumeVersion.findMany({
        where: { userId },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        select: EXPORT_RESUME_VERSION_SELECT,
      }),
    ]);
    return users === 0 ? null : { applications, resumeVersions };
  }
}
