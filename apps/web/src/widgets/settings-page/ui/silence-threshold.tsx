'use client';

import { effectiveSilenceDays, type SettingsSuggestions, type UserSettings } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { settingsSuggestionsQueryOptions } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { recommendedPreset, SILENCE_PRESETS } from '../model/settings-items';
import { SettingsCard, type SettingsControlProps } from './settings-frame';

const COPY = uk.settings.silence;

const PRESET_OPTIONS = SILENCE_PRESETS.map((days) => ({
  value: String(days),
  label: String(days),
}));

function adviceOf(suggestions: SettingsSuggestions): string {
  const median = suggestions.medianResponseDays;
  if (median === null) return COPY.noMedian(suggestions.silenceDays);
  return COPY.median({ median, preset: recommendedPreset(suggestions.silenceDays) });
}

function hintOf(settings: UserSettings, suggestions: SettingsSuggestions | undefined): string {
  const finalStage = COPY.finalStage(effectiveSilenceDays(settings, 'final'));
  return suggestions === undefined ? finalStage : `${adviceOf(suggestions)} ${finalStage}`;
}

export function SilenceThreshold({ settings, onSave }: SettingsControlProps) {
  const suggestions = useQuery(settingsSuggestionsQueryOptions());
  const days = settings.silenceDays;
  const preset = PRESET_OPTIONS.find((option) => option.value === String(days));
  return (
    <SettingsCard className="flex flex-col gap-4.5 p-5">
      <p className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-[40px] leading-none tabular-nums">{days}</span>
        <span className="text-[15px] text-ink-2">{COPY.unit(days)}</span>
      </p>
      <SegmentedControl
        aria-label={COPY.presets}
        options={PRESET_OPTIONS}
        value={preset?.value ?? ''}
        onValueChange={(next) => {
          onSave({ silenceDays: Number(next) });
        }}
      />
      <p className="border-l-2 border-accent py-0.5 pl-3.25 text-[13.5px] leading-[1.55] text-ink-2">
        {hintOf(settings, suggestions.data)}
      </p>
    </SettingsCard>
  );
}
