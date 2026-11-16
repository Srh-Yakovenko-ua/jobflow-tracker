import {
  RESUME_UPLOAD_LIMITS,
  type ResumeDownload,
  type ResumeVersion,
  type ResumeVersionListResponse,
  type UpdateResumeVersionInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { changedOrNotFound, owned } from '../../common/owned.js';
import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../../storage/file-storage.js';
import { pendingKeyOf } from './resume-storage-key.js';
import { RESUME_VERSION_NOT_FOUND, toResumeVersion } from './resume-version-response.js';
import {
  type ResumeVersionById,
  type ResumeVersionRow,
  ResumeVersionsRepository,
} from './resume-versions.repository.js';

export type EditResumeVersion = { id: string; input: UpdateResumeVersionInput };

const REMOVE_TRANSACTION = {
  timeout: DEPENDENCY_LIMITS.queryTimeoutMs + 2 * DEPENDENCY_LIMITS.storageTimeoutMs,
};

@Injectable()
export class ResumeVersionsService {
  constructor(
    private readonly repository: ResumeVersionsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly storage: FileStorage,
  ) {}

  async list(userId: string): Promise<ResumeVersionListResponse> {
    const rows = await this.repository.list(userId);
    return { items: rows.map(toResumeVersion) };
  }

  async update(userId: string, { id, input }: EditResumeVersion): Promise<ResumeVersion> {
    const updatedAt = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(userId, { tx });
      changedOrNotFound(
        await this.repository.update(userId, { id, data: { ...input, updatedAt }, tx }),
        RESUME_VERSION_NOT_FOUND,
      );
      if (input.isArchived === true) {
        await this.repository.setActive(userId, { from: id, to: null, tx });
      }
      return owned(await this.repository.findOwned(userId, { id, tx }), RESUME_VERSION_NOT_FOUND);
    });
    return toResumeVersion(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const version = await this.lockedVersion(userId, { id, tx });
      const linked =
        version._count.applications > 0 ||
        (await this.repository.deleteUnlinked(userId, { id, tx })) === 0;
      if (linked) {
        throw conflict('The version is linked to applications; archive it instead');
      }
      await this.storage.delete(pendingKeyOf(version.storageKey));
      await this.storage.delete(version.storageKey);
    }, REMOVE_TRANSACTION);
  }

  async activate(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const version = await this.lockedVersion(userId, { id, tx });
      if (version.isArchived) {
        throw conflict('Unarchive the version before making it active');
      }
      await this.repository.setActive(userId, { to: id, tx });
    });
  }

  async download(userId: string, id: string): Promise<ResumeDownload> {
    const { storageKey, mime, filename } = owned(
      await this.repository.findOwned(userId, { id }),
      RESUME_VERSION_NOT_FOUND,
    );
    const { url, expiresAt } = await this.storage.createDownloadUrl({
      key: storageKey,
      mime,
      filename,
      signedAt: this.clock.now(),
      ttlSeconds: RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds,
    });
    return { url, expiresAt: expiresAt.toISOString() };
  }

  private async lockedVersion(
    userId: string,
    { id, tx }: Required<ResumeVersionById>,
  ): Promise<ResumeVersionRow> {
    await this.repository.lockOwner(userId, { tx });
    return owned(await this.repository.findOwned(userId, { id, tx }), RESUME_VERSION_NOT_FOUND);
  }
}
