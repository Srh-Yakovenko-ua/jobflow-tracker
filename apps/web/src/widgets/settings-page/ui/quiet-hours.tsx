'use client';

import { userSettingsSchema } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

import { SettingText } from './setting-rows';
import { SettingsCard, type SettingsControlProps } from './settings-frame';

type ClockInputProps = Readonly<{
  label: string;
  value: string;
  onCommit: (value: string) => void;
}>;

const COPY = uk.settings.notifications.quietHours;

const clockSchema = userSettingsSchema.shape.quietHoursStart;

function ClockInput({ label, value, onCommit }: ClockInputProps) {
  return (
    <Field label={label}>
      <Input
        key={value}
        type="time"
        defaultValue={value}
        className="w-32"
        onBlur={({ currentTarget: input }) => {
          if (input.value === value) return;
          if (clockSchema.safeParse(input.value).success) onCommit(input.value);
          else input.value = value;
        }}
      />
    </Field>
  );
}

export function QuietHours({ settings, onSave }: SettingsControlProps) {
  return (
    <SettingsCard className="flex flex-col gap-3.5 px-5 py-4">
      <SettingText copy={COPY} />
      <div className="flex flex-wrap gap-4">
        <ClockInput
          label={COPY.start}
          value={settings.quietHoursStart}
          onCommit={(quietHoursStart) => {
            onSave({ quietHoursStart });
          }}
        />
        <ClockInput
          label={COPY.end}
          value={settings.quietHoursEnd}
          onCommit={(quietHoursEnd) => {
            onSave({ quietHoursEnd });
          }}
        />
      </div>
    </SettingsCard>
  );
}
