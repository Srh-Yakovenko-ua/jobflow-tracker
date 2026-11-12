import type { ResumeVersionLabelParts, UpdateResumeVersionInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { withoutUndefined } from '../../common/without-undefined.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { LATEST_AI_JOB_SELECT } from '../../prisma/latest-ai-job.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type ResumeEvent, resumeEvent } from './resumes.events.js';

export const DEFAULT_RESUME_TITLE = 'Резюме';

export const RESUME_VERSION_SELECT = {
  id: true,
  number: true,
  title: true,
  note: true,
  filename: true,
  mime: true,
  sizeBytes: true,
  isArchived: true,
  uploadedAt: true,
  storageKey: true,
  aiProfile: true,
  aiJobs: {
    ...LATEST_AI_JOB_SELECT,
    select: { ...LATEST_AI_JOB_SELECT.select, errorType: true },
  },
  _count: { select: { applications: { where: { deletedAt: null } } } },
} satisfies Prisma.ResumeVersionSelect;

const PROFILE_SOURCE_SELECT = {
  storageKey: true,
  filename: true,
  mime: true,
  aiProfile: true,
} satisfies Prisma.ResumeVersionSelect;

export type ProfileSource = Prisma.ResumeVersionGetPayload<{
  select: typeof PROFILE_SOURCE_SELECT;
}>;

export type ExtractedText = { id: string; text: string };

export type ResumeProfile = { id: string; profile: Prisma.InputJsonValue };

export type SaveResumeProfile = InTransaction & ResumeProfile;

export type ResumeVersionRow = Prisma.ResumeVersionGetPayload<{
  select: typeof RESUME_VERSION_SELECT;
}>;

export type ResumeVersionById = InTransaction & { id: string };

export type VersionByStorageKey = InTransaction & { storageKey: string };

export type VersionsOfResume = InTransaction & { resumeId: string };

export type NewResumeVersion = Omit<
  Prisma.ResumeVersionUncheckedCreateInput,
  'userId' | 'id' | 'createdAt' | 'updatedAt'
>;

export type InsertResumeVersion = InTransaction & { data: NewResumeVersion };

export type UpdateResumeVersion = ResumeVersionById & {
  data: UpdateResumeVersionInput & { updatedAt: Date };
};

export type RecordResumeEvent = InTransaction & { event: ResumeEvent };

export type ApplicationLink = { resumeVersionId: string | null };

export type ApplicationById = InTransaction & { applicationId: string };

export type RelinkApplication = ApplicationById & { resumeVersionId: string };

@Injectable()
export class ResumeVersionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockOwner(userId: string, { tx = this.prisma }: InTransaction = {}): Promise<void> {
    await tx.$queryRaw`SELECT user_id FROM user_settings WHERE user_id = ${userId}::uuid FOR UPDATE`;
  }

  findByStorageKey(
    userId: string,
    { storageKey, tx = this.prisma }: VersionByStorageKey,
  ): Promise<{ id: string } | null> {
    return tx.resumeVersion.findFirst({ where: { storageKey, userId }, select: { id: true } });
  }

  async findOrCreateResume(
    userId: string,
    { tx = this.prisma }: InTransaction = {},
  ): Promise<string> {
    const resume =
      (await tx.resume.findFirst({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      })) ??
      (await tx.resume.create({
        data: { userId, title: DEFAULT_RESUME_TITLE },
        select: { id: true },
      }));
    return resume.id;
  }

  async nextNumber(
    userId: string,
    { resumeId, tx = this.prisma }: VersionsOfResume,
  ): Promise<number> {
    const { _max } = await tx.resumeVersion.aggregate({
      where: { userId, resumeId },
      _max: { number: true },
    });
    return (_max.number ?? 0) + 1;
  }

  insert(
    userId: string,
    { data, tx = this.prisma }: InsertResumeVersion,
  ): Promise<ResumeVersionRow> {
    return tx.resumeVersion.create({ data: { ...data, userId }, select: RESUME_VERSION_SELECT });
  }

  list(userId: string): Promise<ResumeVersionRow[]> {
    return this.prisma.resumeVersion.findMany({
      where: { userId },
      orderBy: [{ number: 'desc' }, { id: 'desc' }],
      select: RESUME_VERSION_SELECT,
    });
  }

  findOwned(
    userId: string,
    { id, tx = this.prisma }: ResumeVersionById,
  ): Promise<ResumeVersionRow | null> {
    return tx.resumeVersion.findFirst({ where: { id, userId }, select: RESUME_VERSION_SELECT });
  }

  findForProfile(userId: string, id: string): Promise<ProfileSource | null> {
    return this.prisma.resumeVersion.findFirst({
      where: { id, userId },
      select: PROFILE_SOURCE_SELECT,
    });
  }

  async saveExtractedText(userId: string, { id, text }: ExtractedText): Promise<number> {
    const { count } = await this.prisma.resumeVersion.updateMany({
      where: { id, userId },
      data: { textExtracted: text },
    });
    return count;
  }

  async saveProfile(
    userId: string,
    { id, profile, tx = this.prisma }: SaveResumeProfile,
  ): Promise<number> {
    const { count } = await tx.resumeVersion.updateMany({
      where: { id, userId },
      data: { aiProfile: profile },
    });
    return count;
  }

  async update(
    userId: string,
    { id, data, tx = this.prisma }: UpdateResumeVersion,
  ): Promise<number> {
    const { count } = await tx.resumeVersion.updateMany({
      where: { id, userId },
      data: withoutUndefined(data),
    });
    return count;
  }

  async clearActive(userId: string, { id, tx = this.prisma }: ResumeVersionById): Promise<void> {
    await tx.userSettings.updateMany({
      where: { userId, activeResumeVersionId: id },
      data: { activeResumeVersionId: null },
    });
  }

  async activate(userId: string, { id, tx = this.prisma }: ResumeVersionById): Promise<void> {
    await tx.userSettings.updateMany({ where: { userId }, data: { activeResumeVersionId: id } });
  }

  async deleteUnlinked(
    userId: string,
    { id, tx = this.prisma }: ResumeVersionById,
  ): Promise<number> {
    const { count } = await tx.resumeVersion.deleteMany({
      where: { id, userId, applications: { none: { deletedAt: null } } },
    });
    return count;
  }

  findVersionLabel(
    userId: string,
    { id, tx = this.prisma }: ResumeVersionById,
  ): Promise<ResumeVersionLabelParts | null> {
    return tx.resumeVersion.findFirst({
      where: { id, userId },
      select: { number: true, title: true },
    });
  }

  findApplicationLink(
    userId: string,
    { applicationId, tx = this.prisma }: ApplicationById,
  ): Promise<ApplicationLink | null> {
    return tx.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: { resumeVersionId: true },
    });
  }

  async relinkApplication(
    userId: string,
    { applicationId, resumeVersionId, tx = this.prisma }: RelinkApplication,
  ): Promise<number> {
    const { count } = await tx.application.updateMany({
      where: { id: applicationId, userId, deletedAt: null },
      data: { resumeVersionId },
    });
    return count;
  }

  async recordEvent(userId: string, { event, tx = this.prisma }: RecordResumeEvent): Promise<void> {
    await tx.outboxEvent.create({ data: resumeEvent(userId, event), select: { id: true } });
  }
}
