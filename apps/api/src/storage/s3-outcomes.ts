import { NoSuchKey, NotFound, S3ServiceException } from '@aws-sdk/client-s3';

import { AppError, ERROR_TYPES } from '../common/app-error.js';
import { DEPENDENCY_LIMITS } from '../common/probe.js';

export const STORAGE_DOWN_DETAIL = 'File storage did not answer';

export const withinStorageLimit = () => ({
  abortSignal: AbortSignal.timeout(DEPENDENCY_LIMITS.storageTimeoutMs),
});

export const storageDown = (cause: unknown) =>
  new AppError({ ...ERROR_TYPES[503], status: 503, detail: STORAGE_DOWN_DETAIL, cause });

const isMissing = (error: unknown) => error instanceof NotFound || error instanceof NoSuchKey;

const isPreconditionFailed = (error: unknown) =>
  error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412;

export async function orMissing<T>(call: Promise<T>): Promise<T | null> {
  try {
    return await call;
  } catch (error) {
    if (isMissing(error) || isPreconditionFailed(error)) {
      return null;
    }
    throw storageDown(error);
  }
}

export function orDown<T>(call: Promise<T>): Promise<T> {
  return call.catch((error: unknown) => {
    throw storageDown(error);
  });
}
