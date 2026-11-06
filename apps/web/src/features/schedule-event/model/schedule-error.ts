import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

export function isScheduleConflict(error: Error): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function showScheduleError(error: Error): void {
  showErrorToast(
    isScheduleConflict(error) ? uk.applicationPage.schedule.conflict : uk.errors.saveFailed,
  );
}
