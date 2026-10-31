import type { UserSettings } from '@jobflow/shared';
import type { ReactNode } from 'react';

import type { SettingsSave } from '@/features/update-settings';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { SettingsSectionId } from '../model/settings-items';

export type SettingsSectionProps = Readonly<{ id: SettingsSectionId; children: ReactNode }>;

export function SettingsSection({ id, children }: SettingsSectionProps) {
  return (
    <section id={id} aria-label={uk.settings.sections[id]} className="flex flex-col gap-7">
      {children}
    </section>
  );
}

export type SettingsHeading = { title: string; description?: string };

export type SettingsBlockProps = Readonly<{
  heading: SettingsHeading;
  status?: ReactNode;
  children: ReactNode;
}>;

export function SettingsBlock({ heading, status, children }: SettingsBlockProps) {
  return (
    <div className={cn('flex flex-col', heading.description === undefined ? 'gap-3.5' : 'gap-4')}>
      <div className="flex flex-col gap-1.25">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-[24px] leading-[1.2] font-medium">{heading.title}</h2>
          {status}
        </div>
        {heading.description !== undefined && (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.55] text-ink-2">
            {heading.description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export type SettingsCardProps = Readonly<{ children: ReactNode; className?: string }>;

export function SettingsCard({ children, className }: SettingsCardProps) {
  return <div className={cn('bg-surface shadow-e1', className)}>{children}</div>;
}

export type SettingsControlProps = Readonly<{
  settings: UserSettings;
  onSave: SettingsSave['save'];
}>;
