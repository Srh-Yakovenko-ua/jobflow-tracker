'use client';

import { uk } from '@/shared/i18n';
import { Combobox } from '@/shared/ui/combobox';
import { Field } from '@/shared/ui/field';

import { timeZoneOptions } from '../model/time-zone-options';
import type { SettingsControlProps } from './settings-frame';

const COPY = uk.settings.notifications.timezone;

export function TimeZoneField({ settings, onSave }: SettingsControlProps) {
  return (
    <div className="max-w-sm">
      <Field label={COPY.label} footer={{ hint: COPY.hint }}>
        <Combobox
          groups={[{ options: timeZoneOptions(settings.timezone) }]}
          selection={{
            mode: 'single',
            value: settings.timezone,
            onValueChange: (timezone) => {
              if (timezone !== '' && timezone !== settings.timezone) onSave({ timezone });
            },
          }}
          view={{ label: COPY.label, search: COPY.search, clearable: false }}
        />
      </Field>
    </div>
  );
}
