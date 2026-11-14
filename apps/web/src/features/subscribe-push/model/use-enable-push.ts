'use client';

import { pushSubscriptionInputSchema } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { applicationServerKeyOf, pushRegistration } from '@/shared/lib/web-push';
import { showErrorToast } from '@/shared/ui/error-toast';

import { pushPublicKeyQueryOptions, savePushSubscription } from '../api/push';
import { pushKeys } from './keys';

export type EnablePushActions = Readonly<{ onEnabled?: () => void; onDenied?: () => void }>;

export type EnablePush = Readonly<{
  enable: (permission: Promise<NotificationPermission>) => void;
  pending: boolean;
}>;

function sameKey(current: ArrayBuffer | null, wanted: Uint8Array): boolean {
  if (current === null) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((byte, at) => byte === wanted[at]);
}

async function subscriptionFor(publicKey: string): Promise<PushSubscription> {
  const registration = await pushRegistration();
  const applicationServerKey = applicationServerKeyOf(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing !== null && sameKey(existing.options.applicationServerKey, applicationServerKey)) {
    return existing;
  }
  await existing?.unsubscribe();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
}

export function useEnablePush({ onEnabled, onDenied }: EnablePushActions): EnablePush {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: async (permission: Promise<NotificationPermission>) => {
      const answer = await permission;
      if (answer !== 'granted') return answer;
      const { publicKey } = await queryClient.query(pushPublicKeyQueryOptions());
      if (publicKey === null) throw new Error('push is off on the server');
      const subscription = await subscriptionFor(publicKey);
      await savePushSubscription(pushSubscriptionInputSchema.parse(subscription.toJSON()));
      return answer;
    },
    onSuccess: (answer) => {
      if (answer === 'granted') {
        void queryClient.invalidateQueries({ queryKey: pushKeys.browserSubscribed() });
        onEnabled?.();
      }
      if (answer === 'denied') onDenied?.();
    },
    onError: (error) => {
      logger.warn({ err: error }, 'push not enabled');
      showErrorToast(uk.push.enableFailed);
    },
  });
  return { enable: mutate, pending: isPending };
}
