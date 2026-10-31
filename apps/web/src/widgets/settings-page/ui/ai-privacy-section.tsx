import { uk } from '@/shared/i18n';

import type { SettingsItems } from '../model/settings-items';
import { SettingNote } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';

export type AiPrivacySectionProps = Readonly<{ items: SettingsItems }>;

const COPY = uk.settings.aiPrivacy;

export function AiPrivacySection({ items }: AiPrivacySectionProps) {
  return (
    <SettingsSection id="aiPrivacy">
      <SettingsBlock heading={COPY}>
        <SettingsCard className="divide-y divide-line-soft">
          <div className="flex flex-col gap-2.5 px-5 py-4">
            <h3 className="text-[14.5px] leading-[1.4] font-semibold">{COPY.modelData.title}</h3>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-[13.5px] leading-[1.55] text-ink-2">
              {COPY.modelData.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {items.aiDataDeletion && <SettingNote copy={COPY.dataDeletion} />}
          {items.captureToken && <SettingNote copy={COPY.captureToken} />}
        </SettingsCard>
      </SettingsBlock>
    </SettingsSection>
  );
}
