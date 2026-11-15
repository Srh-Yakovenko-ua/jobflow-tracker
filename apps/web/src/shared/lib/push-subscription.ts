import { logger } from './logger';

export const PUSH_WORKER = { path: '/sw.js', scope: '/' } as const;

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER.scope);
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
