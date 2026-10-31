'use client';

import type { UserSettings } from '@jobflow/shared';

import { useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';

import type { SettingsItems } from '../model/settings-items';
import { QuietHours } from './quiet-hours';
import { SaveStatus } from './save-status';
import { SettingSwitch } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';
import { TimeZoneField } from './time-zone-field';

export type NotificationsSectionProps = Readonly<{
  settings: UserSettings;
  items: SettingsItems;
}>;

const COPY = uk.settings.notifications;

export function NotificationsSection({ settings, items }: NotificationsSectionProps) {
  const { save, status } = useUpdateSettingsMutation();
  return (
    <SettingsSection id="notifications">
      <SettingsBlock heading={{ title: COPY.title }} status={<SaveStatus status={status} />}>
        <SettingsCard className="divide-y divide-line-soft">
          <SettingSwitch
            copy={COPY.inApp}
            checked={settings.notifyInApp}
            onCheckedChange={(notifyInApp) => {
              save({ notifyInApp });
            }}
          />
          {items.notifyPush && (
            <SettingSwitch
              copy={COPY.push}
              checked={settings.notifyPush}
              onCheckedChange={(notifyPush) => {
                save({ notifyPush });
              }}
            />
          )}
          {items.notifyEmail && (
            <SettingSwitch
              copy={COPY.email}
              checked={settings.notifyEmail}
              onCheckedChange={(notifyEmail) => {
                save({ notifyEmail });
              }}
            />
          )}
        </SettingsCard>
        <QuietHours settings={settings} onSave={save} />
        <TimeZoneField settings={settings} onSave={save} />
      </SettingsBlock>
    </SettingsSection>
  );
}
