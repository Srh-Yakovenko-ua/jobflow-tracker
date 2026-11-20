import { apiStatusOf, HTTP_STATUS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

export function isScheduleConflict(error: Error): boolean {
  return apiStatusOf(error) === HTTP_STATUS.conflict;
}

export function showScheduleError(error: Error): void {
  showErrorToast(
    isScheduleConflict(error) ? uk.applicationPage.schedule.conflict : uk.errors.saveFailed,
  );
}
