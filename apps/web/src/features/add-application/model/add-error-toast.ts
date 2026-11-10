import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { formatDuration } from '@/shared/lib/state-format';
import type { ErrorToastContent } from '@/shared/ui/error-toast';

const COPY = uk.add.errors;

export function parseLimitToast(retryAfterSeconds: number | undefined): ErrorToastContent {
  return {
    title: COPY.parseLimit.title,
    description:
      retryAfterSeconds === undefined
        ? COPY.parseLimit.later
        : COPY.parseLimit.wait(formatDuration(retryAfterSeconds)),
  };
}

export function addErrorToastOf(error: Error): ErrorToastContent {
  if (!(error instanceof ApiError)) return uk.errors.saveFailed;
  if (error.status === 409) return COPY.noActiveSearch;
  if (error.status === 429) return parseLimitToast(error.retryAfterSeconds);
  return uk.errors.saveFailed;
}
