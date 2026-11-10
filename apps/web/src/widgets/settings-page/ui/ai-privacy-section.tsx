import { DeleteAiResultsDialog } from '@/features/delete-ai-results';
import { InstallBookmarklet } from '@/features/install-bookmarklet';
import { uk } from '@/shared/i18n';
import { SETTINGS_ANCHORS } from '@/shared/lib/settings-anchors';

import { modelDataItems } from '../model/model-data-items';
import type { SettingsItems } from '../model/settings-items';
import { SettingNote } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';

export type AiPrivacySectionProps = Readonly<{ items: SettingsItems }>;

const COPY = uk.settings.aiPrivacy;

const MODEL_DATA = modelDataItems();

export function AiPrivacySection({ items }: AiPrivacySectionProps) {
  return (
    <SettingsSection id="aiPrivacy">
      <SettingsBlock heading={COPY}>
        <SettingsCard className="divide-y divide-line-soft">
          <div className="flex flex-col gap-2.5 px-5 py-4">
            <h3 className="text-[14.5px] leading-[1.4] font-semibold">{COPY.modelData.title}</h3>
            <ul
              aria-label={COPY.modelData.title}
              className="flex list-disc flex-col gap-1.5 ps-5 text-[13.5px] leading-[1.55] text-ink-2"
            >
              {MODEL_DATA.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          </div>
          {items.aiDataDeletion && (
            <SettingNote copy={COPY.dataDeletion} action={<DeleteAiResultsDialog />} />
          )}
        </SettingsCard>
      </SettingsBlock>
      {items.captureToken && (
        <SettingsBlock id={SETTINGS_ANCHORS.bookmarklet} heading={uk.bookmarklet.heading}>
          <SettingsCard className="px-5 py-4">
            <InstallBookmarklet />
          </SettingsCard>
        </SettingsBlock>
      )}
    </SettingsSection>
  );
}
