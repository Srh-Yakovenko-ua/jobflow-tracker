import { useSyncExternalStore } from 'react';

import { logger } from './logger';
import { PUSH_WORKER, pushSupported } from './push-subscription';

export type PushPermission = NotificationPermission | 'unsupported';

export const PUSH_ICON_PATH = '/icons/jobflow-192.png';

export function applicationServerKeyOf(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(PUSH_WORKER.scope);
  if (existing === undefined) {
    await navigator.serviceWorker.register(PUSH_WORKER.path, {
      scope: PUSH_WORKER.scope,
      updateViaCache: 'none',
    });
  }
  return navigator.serviceWorker.ready;
}

function permissionNow(): PushPermission {
  return pushSupported() ? Notification.permission : 'unsupported';
}

function unsupportedOnServer(): PushPermission {
  return 'unsupported';
}

function permissionChanges(onChange: () => void): () => void {
  if (!pushSupported() || !('permissions' in navigator)) return () => undefined;
  const watch: { closed: boolean; status?: PermissionStatus } = { closed: false };
  navigator.permissions.query({ name: 'notifications' }).then(
    (status) => {
      if (watch.closed) return;
      watch.status = status;
      status.addEventListener('change', onChange);
    },
    (error: unknown) => {
      logger.warn({ err: error }, 'notification permission not watched');
    },
  );
  return () => {
    watch.closed = true;
    watch.status?.removeEventListener('change', onChange);
  };
}

export function usePushPermission(): PushPermission {
  return useSyncExternalStore(permissionChanges, permissionNow, unsupportedOnServer);
}
