'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { FEATURE_FLAGS } from '@/shared/config';
import { uk } from '@/shared/i18n';

import { activeHrefOf, type ShellNav, visibleNavItems } from '../model/nav-items';
import type { SidebarState } from '../model/sidebar-cookie';
import { SidebarStoreProvider } from '../model/sidebar-store';
import { useSilentCount } from '../model/use-silent-count';
import { BottomBar } from './bottom-bar';
import { ShellHeader } from './shell-header';
import { Sidebar } from './sidebar';

export type AppShellProps = Readonly<{ initial: SidebarState; children: ReactNode }>;

const ITEMS = visibleNavItems(FEATURE_FLAGS);

const SKIP_LINK =
  'sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2.5 focus:text-[13.5px] focus:font-semibold focus:text-ink focus:shadow-e2';

export function AppShell({ initial, children }: AppShellProps) {
  const activeHref = activeHrefOf(usePathname(), ITEMS);
  const nav: ShellNav = { items: ITEMS, activeHref, badges: { silent: useSilentCount() } };
  const active = ITEMS.find((item) => item.href === activeHref);
  return (
    <SidebarStoreProvider initial={initial}>
      <div data-app-shell className="flex min-h-dvh">
        <a href="#main" className={SKIP_LINK}>
          {uk.shell.skipToContent}
        </a>
        <Sidebar nav={nav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ShellHeader title={active && uk.shell.nav[active.id]} />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 px-4 pt-4 pb-[calc(var(--spacing)*18_+_env(safe-area-inset-bottom))] md:p-6.5"
          >
            {children}
          </main>
        </div>
        <BottomBar nav={nav} />
      </div>
    </SidebarStoreProvider>
  );
}
