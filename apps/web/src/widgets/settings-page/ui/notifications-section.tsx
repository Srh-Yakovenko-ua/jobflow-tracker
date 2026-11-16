'use client';

import { EMAIL_SETTING_OF, EMAILED_TYPES, type UserSettings } from '@jobflow/shared';

import { type SettingsSave, useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';
import { Reveal } from '@/shared/ui/reveal';

import type { SettingsItems } from '../model/settings-items';
import { PushSettingRow } from './push-setting-row';
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

type EmailTypeSwitchesProps = Readonly<{ settings: UserSettings; save: SettingsSave['save'] }>;

function EmailTypeSwitches({ settings, save }: EmailTypeSwitchesProps) {
  return (
    <Reveal shown={settings.notifyEmail}>
      <div role="group" aria-label={COPY.email.title} className="divide-y divide-line-soft ps-5">
        {EMAILED_TYPES.map((type) => {
          const key = EMAIL_SETTING_OF[type];
          return (
            <SettingSwitch
              key={type}
              copy={COPY.email.types[type]}
              checked={settings[key]}
              onCheckedChange={(checked) => {
                save({ [key]: checked });
              }}
            />
          );
        })}
      </div>
    </Reveal>
  );
}

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
          {items.notifyPush && <PushSettingRow settings={settings} save={save} />}
          {items.notifyEmail && (
            <SettingSwitch
              copy={COPY.email}
              checked={settings.notifyEmail}
              onCheckedChange={(notifyEmail) => {
                save({ notifyEmail });
              }}
            />
          )}
          {items.notifyEmail && <EmailTypeSwitches settings={settings} save={save} />}
        </SettingsCard>
        <QuietHours settings={settings} onSave={save} />
        <TimeZoneField settings={settings} onSave={save} />
      </SettingsBlock>
    </SettingsSection>
  );
}
