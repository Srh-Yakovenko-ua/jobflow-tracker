import { type DocumentExtraction, RESUME_UPLOAD_LIMITS } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { FileStorage } from '../../storage/file-storage.js';
import { DocumentsClient } from './documents-client.js';
import type { ProfileSource } from './resume-versions.repository.js';

@Injectable()
export class ResumeExtractionService {
  constructor(
    private readonly storage: FileStorage,
    private readonly documents: DocumentsClient,
  ) {}

  async extract({ storageKey, filename, mime }: ProfileSource): Promise<DocumentExtraction | null> {
    const bytes = await this.storage.readStart({
      key: storageKey,
      bytes: RESUME_UPLOAD_LIMITS.maxBytes,
    });
    return bytes.length === 0 ? null : this.documents.extract({ bytes, filename, mime });
  }
}
