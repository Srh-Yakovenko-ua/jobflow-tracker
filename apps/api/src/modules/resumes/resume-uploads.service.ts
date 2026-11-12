import { randomUUID } from 'node:crypto';

import {
  type ConfirmedResumeUpload,
  type ConfirmResumeUploadInput,
  type CreateResumeVersionInput,
  RESUME_UPLOAD_LIMITS,
  type ResumeUploadInput,
  type ResumeUploadTicket,
  type ResumeVersion,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict, notFound, validation } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage, type StoredObject } from '../../storage/file-storage.js';
import { detectResumeFormat, RESUME_SIGNATURE_BYTES } from './resume-file-format.js';
import { pendingResumeKey, resumeStorageKey } from './resume-storage-key.js';
import { toResumeVersion } from './resume-version-response.js';
import { ResumeVersionWriter } from './resume-version-writer.js';

export type ResumeUploadTarget = ConfirmResumeUploadInput & Pick<ConfirmedResumeUpload, 'uploadId'>;

type UploadKey = ConfirmResumeUploadInput & { key: string };

type StoredUpload = UploadKey & { stored: StoredObject };

type VersionCopy = { from: string; to: string; etag: string | null; tx: Prisma.TransactionClient };

@Injectable()
export class ResumeUploadsService {
  constructor(
    private readonly storage: FileStorage,
    private readonly clock: Clock,
    private readonly prisma: PrismaService,
    private readonly writer: ResumeVersionWriter,
  ) {}

  async createUploadTicket(
    userId: string,
    { mime, sizeBytes }: ResumeUploadInput,
  ): Promise<ResumeUploadTicket> {
    const uploadId = randomUUID();
    const { url, expiresAt } = await this.storage.createUploadUrl({
      key: pendingResumeKey({ userId, uploadId, mime }),
      mime,
      sizeBytes,
      signedAt: this.clock.now(),
    });
    return {
      uploadId,
      url,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirm(
    userId: string,
    { uploadId, mime }: ResumeUploadTarget,
  ): Promise<ConfirmedResumeUpload> {
    const stored = await this.checkedUpload({
      key: pendingResumeKey({ userId, uploadId, mime }),
      mime,
    });
    return { uploadId, mime, sizeBytes: stored.sizeBytes };
  }

  async createVersion(userId: string, input: CreateResumeVersionInput): Promise<ResumeVersion> {
    const ref = { userId, uploadId: input.uploadId, mime: input.mime };
    const from = pendingResumeKey(ref);
    const stored = await this.checkedUpload({ key: from, mime: input.mime });
    const uploadedAt = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const storageKey = resumeStorageKey(ref);
      await this.copyOnce(userId, { from, to: storageKey, etag: stored.etag, tx });
      return this.writer.insert(userId, { input, storageKey, stored, uploadedAt, tx });
    });
    return toResumeVersion(row);
  }

  private async copyOnce(userId: string, { from, to, etag, tx }: VersionCopy): Promise<void> {
    await this.writer.claim(userId, { storageKey: to, tx });
    const copied = etag !== null && (await this.storage.copy({ from, to, ifMatch: etag }));
    if (!copied) {
      throw conflict('The file changed after the check; upload it again');
    }
  }

  private async checkedUpload({ key, mime }: UploadKey): Promise<StoredObject> {
    const stored = await this.storage.head(key);
    if (stored === null) {
      throw notFound('Upload not found');
    }
    const problem = await this.problemWith({ key, mime, stored });
    if (problem !== null) {
      await this.storage.delete(key);
      throw validation([{ path: 'file', message: problem }]);
    }
    return stored;
  }

  private async problemWith({ key, mime, stored }: StoredUpload): Promise<string | null> {
    if (stored.sizeBytes > RESUME_UPLOAD_LIMITS.maxBytes) {
      return `The file is larger than ${String(RESUME_UPLOAD_LIMITS.maxBytes)} bytes`;
    }
    if (stored.mime !== mime) {
      return `The file was stored with a type other than ${mime}`;
    }
    const start = await this.storage.readStart({
      key,
      bytes: RESUME_SIGNATURE_BYTES,
      ifMatch: stored.etag ?? undefined,
    });
    return detectResumeFormat(start) === mime ? null : 'The file content is not a PDF or DOCX';
  }
}
