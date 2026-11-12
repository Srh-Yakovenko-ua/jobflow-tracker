import { type DocumentExtraction, documentExtractionSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import {
  fetchFailureOf,
  refusalTypeOf,
  SERVICE_CALL_ERRORS,
} from '../../common/service-call-error.js';
import { withoutUndefined } from '../../common/without-undefined.js';
import type { Env } from '../../config/env.js';
import { DOCUMENTS_ERRORS, DocumentsError } from './documents-error.js';

export type DocumentsExtract = {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  requestId?: string | undefined;
};

const BAD_GATEWAY = 502;

async function extractionOf(response: Response): Promise<DocumentExtraction> {
  if (!response.ok) {
    throw new DocumentsError({ status: response.status, type: await refusalTypeOf(response) });
  }
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = documentExtractionSchema.safeParse(body);
  if (!parsed.success) {
    throw new DocumentsError({
      status: BAD_GATEWAY,
      type: SERVICE_CALL_ERRORS.unexpectedResponse,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

function formOf({ bytes, filename, mime }: DocumentsExtract): FormData {
  const form = new FormData();
  form.append('file', new Blob([bytes.slice()], { type: mime }), filename);
  return form;
}

@Injectable()
export class DocumentsClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('DOCUMENTS_SERVICE_URL', { infer: true });
  }

  async extract(request: DocumentsExtract): Promise<DocumentExtraction> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/extract`, {
        method: 'POST',
        headers: withoutUndefined({ 'x-request-id': request.requestId }),
        body: formOf(request),
        signal: AbortSignal.timeout(DEPENDENCY_LIMITS.documentsTimeoutMs),
      });
      return await extractionOf(response);
    } catch (error) {
      throw fetchFailureOf(error, {
        timeoutType: DOCUMENTS_ERRORS.timeout,
        ErrorClass: DocumentsError,
      });
    }
  }
}
