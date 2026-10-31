'use client';

import type { MeResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '@/entities/user';
import { FEATURE_FLAGS } from '@/shared/config';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { PageSkeleton } from '@/shared/ui/skeleton';

import { visibleSettingsItems } from '../model/settings-items';
import { AccountSection } from './account-section';
import { AiPrivacySection } from './ai-privacy-section';
import { AppearanceSection } from './appearance-section';
import { NotificationsSection } from './notifications-section';
import { SearchSection } from './search-section';
import { SectionNav } from './section-nav';

const ITEMS = visibleSettingsItems(FEATURE_FLAGS);

function SettingsContent({ me }: Readonly<{ me: MeResponse }>) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)] md:gap-8">
      <SectionNav />
      <div className="flex min-w-0 flex-col gap-14">
        <SearchSection settings={me.settings} />
        <NotificationsSection settings={me.settings} items={ITEMS} />
        <AiPrivacySection items={ITEMS} />
        <AppearanceSection />
        <AccountSection me={me} items={ITEMS} />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const me = useQuery(meQueryOptions());
  if (me.data !== undefined) return <SettingsContent me={me.data} />;
  if (me.isError) {
    return (
      <LoadFailedPanel
        onRetry={() => {
          void me.refetch();
        }}
      />
    );
  }
  return <PageSkeleton />;
}
