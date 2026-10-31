'use client';

import { ThemeTiles } from '@/features/switch-theme';
import { useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';

import { SaveStatus } from './save-status';
import { SettingsBlock, SettingsSection } from './settings-frame';

export function AppearanceSection() {
  const { save, status } = useUpdateSettingsMutation();
  return (
    <SettingsSection id="appearance">
      <SettingsBlock heading={uk.settings.appearance} status={<SaveStatus status={status} />}>
        <ThemeTiles
          onThemeChange={(theme) => {
            save({ theme });
          }}
        />
      </SettingsBlock>
    </SettingsSection>
  );
}
