import { ApiError } from '@/shared/api';
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
    if (!(error instanceof ApiError)) return uk.errors.saveFailed;
    if (error.status === 409) return COPY.noActiveSearch;
    if (error.status === 429) return limitToast(COPY[limit], error.retryAfterSeconds);
    return uk.errors.saveFailed;
  };
}
