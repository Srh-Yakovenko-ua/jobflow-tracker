'use client';

import type { MeResponse } from '@jobflow/shared';

import { useSession } from '@/entities/user';
import { ChangePasswordForm } from '@/features/change-password';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { SettingsItems } from '../model/settings-items';
import { SettingNote } from './setting-rows';
import { SettingsBlock, SettingsCard, SettingsSection } from './settings-frame';

export type AccountSectionProps = Readonly<{ me: MeResponse; items: SettingsItems }>;

const COPY = uk.settings.account;

function Identity({ me }: Readonly<{ me: MeResponse }>) {
  const rows = [
    { term: COPY.name, detail: me.user.displayName ?? me.user.email },
    { term: COPY.email, detail: me.user.email },
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map((row) => (
        <div key={row.term} className="contents">
          <dt className="text-[13px] leading-[1.5] text-ink-3">{row.term}</dt>
          <dd className="truncate text-[14.5px] leading-[1.4] font-semibold">{row.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AccountSection({ me, items }: AccountSectionProps) {
  const session = useSession();
  return (
    <SettingsSection id="account">
      <SettingsBlock heading={{ title: COPY.title }}>
        <SettingsCard className="divide-y divide-line-soft">
          <Identity me={me} />
          <SettingNote
            copy={COPY.logoutEverywhere}
            action={
              <Button
                variant="secondary"
                className={TOUCH_HEIGHT}
                onClick={session.logoutEverywhere}
              >
                {COPY.logoutEverywhere.action}
              </Button>
            }
          />
          {items.accountDeletion && <SettingNote copy={COPY.deletion} />}
        </SettingsCard>
      </SettingsBlock>
      <SettingsBlock heading={{ title: uk.settings.password.title }}>
        <SettingsCard className="px-5 py-4">
          <ChangePasswordForm />
        </SettingsCard>
      </SettingsBlock>
    </SettingsSection>
  );
}
