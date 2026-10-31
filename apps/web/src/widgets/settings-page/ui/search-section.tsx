'use client';

import type { UserSettings } from '@jobflow/shared';

import { useUpdateSettingsMutation } from '@/features/update-settings';
import { uk } from '@/shared/i18n';

import { AUTO_GHOST_DEFAULT_DAYS } from '../model/settings-items';
import { SaveStatus } from './save-status';
import { SettingSwitch } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';
import { SilenceThreshold } from './silence-threshold';

export type SearchSectionProps = Readonly<{ settings: UserSettings }>;

const COPY = uk.settings;

export function SearchSection({ settings }: SearchSectionProps) {
  const { save, status } = useUpdateSettingsMutation();
  return (
    <SettingsSection id="search">
      <SettingsBlock heading={COPY.silence} status={<SaveStatus status={status} />}>
        <SilenceThreshold settings={settings} onSave={save} />
      </SettingsBlock>
      <SettingsBlock heading={{ title: COPY.rules.title }}>
        <SettingsCard className="divide-y divide-line-soft">
          <SettingSwitch
            copy={COPY.rules.autoGhost(settings.autoGhostDays ?? AUTO_GHOST_DEFAULT_DAYS)}
            checked={settings.autoGhostDays !== null}
            onCheckedChange={(checked) => {
              save({ autoGhostDays: checked ? AUTO_GHOST_DEFAULT_DAYS : null });
            }}
          />
          <SettingSwitch
            copy={COPY.rules.askReason}
            checked={settings.askRejectionReason}
            onCheckedChange={(askRejectionReason) => {
              save({ askRejectionReason });
            }}
          />
          <SettingSwitch
            copy={COPY.rules.monthlySummary}
            checked={settings.monthlySummaryEnabled}
            onCheckedChange={(monthlySummaryEnabled) => {
              save({ monthlySummaryEnabled });
            }}
          />
        </SettingsCard>
      </SettingsBlock>
    </SettingsSection>
  );
}
