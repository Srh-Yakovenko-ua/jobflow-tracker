'use client';

import type { UpdateUserSettingsInput, UserSettings } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { pushSupported } from '@/shared/lib/push-subscription';
import { settingsHref } from '@/shared/lib/settings-anchors';
import {
  PUSH_ICON_PATH,
  type PushPermission,
  pushRegistration,
  usePushPermission,
} from '@/shared/lib/web-push';
import { showErrorToast } from '@/shared/ui/error-toast';

import { browserSubscribedQueryOptions, pushPublicKeyQueryOptions } from '../api/push';
import { useEnablePush } from './use-enable-push';

export type PushNote = 'unsupported' | 'serverOff' | 'denied';

export type PushSettingInput = Readonly<{
  settings: UserSettings;
  save: (patch: UpdateUserSettingsInput) => void;
}>;

export type PushSetting = Readonly<{
  checked: boolean;
  disabled: boolean;
  note: PushNote | undefined;
  onCheckedChange: (checked: boolean) => void;
  onTest: () => void;
}>;

type NoteInput = Readonly<{ permission: PushPermission; publicKey: string | null | undefined }>;

const COPY = uk.push;

const TEST_TAG = 'jobflow-test';

function noteOf({ permission, publicKey }: NoteInput): PushNote | undefined {
  if (permission === 'unsupported') return 'unsupported';
  if (publicKey === null) return 'serverOff';
  if (permission === 'denied') return 'denied';
  return undefined;
}

async function showTestNotification(): Promise<void> {
  try {
    const registration = await pushRegistration();
    await registration.showNotification(COPY.test.title, {
      body: COPY.test.body,
      tag: TEST_TAG,
      icon: PUSH_ICON_PATH,
      data: { url: settingsHref('notifications') },
    });
  } catch (error) {
    logger.warn({ err: error }, 'test notification not shown');
    showErrorToast(COPY.testFailed);
  }
}

export function usePushSetting({ settings, save }: PushSettingInput): PushSetting {
  const permission = usePushPermission();
  const publicKey = useQuery({ ...pushPublicKeyQueryOptions(), enabled: pushSupported() }).data
    ?.publicKey;
  const subscribed = useQuery({
    ...browserSubscribedQueryOptions(),
    enabled: permission === 'granted',
  }).data;
  const { enable, pending } = useEnablePush({
    onEnabled: () => {
      save({ notifyPush: true });
    },
  });
  const note = noteOf({ permission, publicKey });
  return {
    checked: settings.notifyPush && permission === 'granted' && subscribed === true,
    disabled: note !== undefined || pending,
    note,
    onCheckedChange: (checked) => {
      if (checked) enable(Notification.requestPermission());
      else save({ notifyPush: false });
    },
    onTest: () => {
      void showTestNotification();
    },
  };
}
