import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { AppShell, ShellSkeleton, SIDEBAR_COOKIE, sidebarFromCookie } from '@/widgets/app-shell';

import { SessionGate } from './session-gate';

export type ProductLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ProductLayout({ children }: ProductLayoutProps) {
  const initial = sidebarFromCookie((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <SessionGate fallback={<ShellSkeleton initial={initial} />}>
      <AppShell initial={initial}>{children}</AppShell>
    </SessionGate>
  );
}
