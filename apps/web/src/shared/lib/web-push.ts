import { useSyncExternalStore } from 'react';

import { logger } from './logger';

export type PushPermission = NotificationPermission | 'unsupported';

export const PUSH_ICON_PATH = '/icons/jobflow-192.png';

const WORKER = { path: '/sw.js', scope: '/' } as const;

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function applicationServerKeyOf(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(WORKER.scope);
  if (existing === undefined) {
    await navigator.serviceWorker.register(WORKER.path, {
      scope: WORKER.scope,
      updateViaCache: 'none',
    });
  }
  return navigator.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(WORKER.scope);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function hasPushSubscription(): Promise<boolean> {
  return pushSupported() && (await currentSubscription()) !== null;
}

export async function dropPushSubscription(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const subscription = await currentSubscription();
    await subscription?.unsubscribe();
  } catch (error) {
    logger.warn({ err: error }, 'push subscription not dropped');
  }
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
