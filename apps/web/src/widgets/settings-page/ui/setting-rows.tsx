import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Switch } from '@/shared/ui/switch';

import type { SettingsHeading } from './settings-frame';

const ROW = 'px-5 py-4';

export type SettingTextProps = Readonly<{ copy: Required<SettingsHeading> }>;

export function SettingText({ copy }: SettingTextProps) {
  return (
    <span className="flex min-w-0 flex-col gap-0.75">
      <span className="text-[14.5px] leading-[1.4] font-semibold text-ink">{copy.title}</span>
      <span className="text-[13px] leading-[1.5] text-ink-3">{copy.description}</span>
    </span>
  );
}

export type SettingSwitchProps = Readonly<{
  copy: Required<SettingsHeading>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>;

export function SettingSwitch({ copy, checked, onCheckedChange }: SettingSwitchProps) {
  return (
    <div className={ROW}>
      <Switch
        placement="end"
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={<SettingText copy={copy} />}
      />
    </div>
  );
}

export type SettingNoteProps = Readonly<{ copy: Required<SettingsHeading>; action?: ReactNode }>;

export function SettingNote({ copy, action }: SettingNoteProps) {
  return (
    <div className={cn(ROW, 'flex flex-wrap items-center justify-between gap-5')}>
      <SettingText copy={copy} />
      {action}
    </div>
  );
}
