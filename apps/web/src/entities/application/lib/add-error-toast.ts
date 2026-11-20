import { ApiError, HTTP_STATUS, isIdempotencyConflict } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { formatDuration } from '@/shared/lib/state-format';
import type { ErrorToastContent } from '@/shared/ui/error-toast';

export type AddLimit = 'parseLimit' | 'requestLimit';

const COPY = uk.add.errors;

type LimitCopy = Readonly<{ title: string; wait: (wait: string) => string; later: string }>;

function limitToast(copy: LimitCopy, retryAfterSeconds: number | undefined): ErrorToastContent {
  return {
    title: copy.title,
    description:
      retryAfterSeconds === undefined ? copy.later : copy.wait(formatDuration(retryAfterSeconds)),
  };
}

export function retryLimitToast(retryAfterSeconds: number | undefined): ErrorToastContent {
  return limitToast(COPY.retryLimit, retryAfterSeconds);
}

export function addErrorToastOf(limit: AddLimit): (error: Error) => ErrorToastContent {
  return (error) => {
    if (isIdempotencyConflict(error)) return COPY.stillRunning;
    if (!(error instanceof ApiError)) return uk.errors.saveFailed;
    if (error.status === HTTP_STATUS.conflict) return COPY.noActiveSearch;
    if (error.status === HTTP_STATUS.tooManyRequests)
      return limitToast(COPY[limit], error.retryAfterSeconds);
    return uk.errors.saveFailed;
  };
}
