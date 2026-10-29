import { uk } from '@/shared/i18n';

import { showToast } from './toast';

export type ErrorToastContent = { title: string; description: string };

const ERROR_TOAST_ID = 'error-toast';

export function showErrorToast(content: ErrorToastContent): void {
  showToast(
    { tone: 'error', ...content, action: { label: uk.app.close, onAction: () => undefined } },
    { id: ERROR_TOAST_ID },
  );
}
