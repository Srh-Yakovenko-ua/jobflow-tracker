import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';

import { ApiError } from '@/shared/api';

import type { FileRefusal } from './resume-file';

export type UploadFailure =
  FileRefusal | { kind: 'fields'; error: ApiError } | { kind: 'retry' } | { kind: 'expired' };

export type FailedUpload = Readonly<{ error: Error; file: File }>;

type RefusalBuilder = (file: File) => FileRefusal;

const REFUSED_PATHS: Readonly<Record<string, RefusalBuilder>> = {
  sizeBytes: (file) => ({
    kind: 'tooBig',
    file: { sizeBytes: file.size, limitBytes: RESUME_UPLOAD_LIMITS.maxBytes },
  }),
  mime: () => ({ kind: 'unsupported' }),
  file: () => ({ kind: 'unreadable' }),
};

const SENT_AGAIN_KINDS: ReadonlySet<UploadFailure['kind']> = new Set([
  'fields',
  'retry',
  'expired',
]);

export function uploadFailureOf({ error, file }: FailedUpload): UploadFailure {
  if (!(error instanceof ApiError) || error.status !== 422) return { kind: 'retry' };
  for (const { path } of error.body.errors ?? []) {
    if (path === 'uploadId') return { kind: 'expired' };
    const refusal = REFUSED_PATHS[path];
    if (refusal !== undefined) return refusal(file);
  }
  return { kind: 'fields', error };
}

export function isFileRefusal(failure: UploadFailure | null): failure is FileRefusal {
  return failure !== null && !SENT_AGAIN_KINDS.has(failure.kind);
}
