'use client';

import type { UserSettings } from '@jobflow/shared';

import { ThemeTiles } from '@/features/switch-theme';
import { useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';

import { SaveStatus } from './save-status';
import { SettingSwitch } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';

export type AppearanceSectionProps = Readonly<{ settings: UserSettings }>;

export function AppearanceSection({ settings }: AppearanceSectionProps) {
  const { save, status } = useUpdateSettingsMutation();
  return (
    <SettingsSection id="appearance">
      <SettingsBlock heading={uk.settings.appearance} status={<SaveStatus status={status} />}>
        <ThemeTiles
          onThemeChange={(theme) => {
            save({ theme });
          }}
        />
        <SettingsCard>
          <SettingSwitch
            copy={uk.settings.singleKeyShortcuts}
            checked={settings.singleKeyShortcuts}
            onCheckedChange={(singleKeyShortcuts) => {
              save({ singleKeyShortcuts });
            }}
          />
        </SettingsCard>
      </SettingsBlock>
    </SettingsSection>
  );
}
