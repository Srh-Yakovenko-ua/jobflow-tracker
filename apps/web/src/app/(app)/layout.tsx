import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { AppShell, SIDEBAR_COOKIE, sidebarFromCookie } from '@/widgets/app-shell';

export type ProductLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ProductLayout({ children }: ProductLayoutProps) {
  const initial = sidebarFromCookie((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return <AppShell initial={initial}>{children}</AppShell>;
}
