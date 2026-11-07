import { randomUUID } from 'node:crypto';

import {
  type ConfirmedResumeUpload,
  type ConfirmResumeUploadInput,
  RESUME_UPLOAD_LIMITS,
  type ResumeUploadInput,
  type ResumeUploadTicket,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound, validation } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { FileStorage, type StoredObject } from '../../storage/file-storage.js';
import { detectResumeFormat, RESUME_SIGNATURE_BYTES } from './resume-file-format.js';
import { resumeStorageKey } from './resume-storage-key.js';

export type ResumeUploadTarget = ConfirmResumeUploadInput & Pick<ConfirmedResumeUpload, 'uploadId'>;

type StoredUpload = ConfirmResumeUploadInput & { key: string; stored: StoredObject };

@Injectable()
export class ResumeUploadsService {
  constructor(
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async createUploadTicket(
    userId: string,
    { mime, sizeBytes }: ResumeUploadInput,
  ): Promise<ResumeUploadTicket> {
    const uploadId = randomUUID();
    const { url, expiresAt } = await this.storage.createUploadUrl({
      key: resumeStorageKey({ userId, uploadId, mime }),
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
    const key = resumeStorageKey({ userId, uploadId, mime });
    const stored = await this.storage.head(key);
    if (stored === null) {
      throw notFound('Upload not found');
    }
    const problem = await this.problemWith({ key, mime, stored });
    if (problem !== null) {
      await this.storage.delete(key);
      throw validation([{ path: 'file', message: problem }]);
    }
    return { uploadId, mime, sizeBytes: stored.sizeBytes };
  }

  private async problemWith({ key, mime, stored }: StoredUpload): Promise<string | null> {
    if (stored.sizeBytes > RESUME_UPLOAD_LIMITS.maxBytes) {
      return `The file is larger than ${String(RESUME_UPLOAD_LIMITS.maxBytes)} bytes`;
    }
    if (stored.mime !== mime) {
      return `The file was stored with a type other than ${mime}`;
    }
    const start = await this.storage.readStart({ key, bytes: RESUME_SIGNATURE_BYTES });
    return detectResumeFormat(start) === mime ? null : 'The file content is not a PDF or DOCX';
  }
}
