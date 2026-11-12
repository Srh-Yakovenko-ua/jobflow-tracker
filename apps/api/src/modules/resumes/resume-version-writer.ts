import type { CreateResumeVersionInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { StoredObject } from '../../storage/file-storage.js';
import { AiService } from '../ai/index.js';
import { type ResumeVersionRow, ResumeVersionsRepository } from './resume-versions.repository.js';
import { RESUME_EVENTS } from './resumes.events.js';

export type VersionClaim = { storageKey: string; tx: Prisma.TransactionClient };

export type VersionInsert = VersionClaim & {
  input: CreateResumeVersionInput;
  stored: StoredObject;
  uploadedAt: Date;
};

@Injectable()
export class ResumeVersionWriter {
  constructor(
    private readonly versions: ResumeVersionsRepository,
    private readonly ai: AiService,
  ) {}

  async claim(userId: string, { storageKey, tx }: VersionClaim): Promise<void> {
    await this.versions.lockOwner(userId, { tx });
    if ((await this.versions.findByStorageKey(userId, { storageKey, tx })) !== null) {
      throw conflict('A version from this upload already exists');
    }
  }

  async insert(
    userId: string,
    { input, storageKey, stored, uploadedAt, tx }: VersionInsert,
  ): Promise<ResumeVersionRow> {
    const resumeId = await this.versions.findOrCreateResume(userId, { tx });
    const number = await this.versions.nextNumber(userId, { resumeId, tx });
    const { filename, mime, title, note = null } = input;
    const data = { resumeId, number, storageKey, filename, mime, sizeBytes: stored.sizeBytes };
    const row = await this.versions.insert(userId, {
      data: { ...data, title, note, uploadedAt },
      tx,
    });
    const resumeVersionId = row.id;
    const aiJobId = await this.ai.createJob(userId, { kind: 'resume_parse', resumeVersionId, tx });
    await this.versions.recordEvent(userId, {
      event: { eventType: RESUME_EVENTS.versionUploaded, resumeVersionId, aiJobId },
      tx,
    });
    return row;
  }
}
