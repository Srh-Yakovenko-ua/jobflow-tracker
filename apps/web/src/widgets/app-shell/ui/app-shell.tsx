'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useSilentCount } from '@/entities/application';
import { useSingleKeyShortcuts } from '@/entities/user';
import { FEATURE_FLAGS } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { PageCommandsProvider } from '@/shared/lib/page-commands';

import { activeHrefOf, type ShellNav, shellTitleOf, visibleNavItems } from '../model/nav-items';
import { shortcutsOf } from '../model/palette-commands';
import type { SidebarState } from '../model/sidebar-cookie';
import { SidebarStoreProvider } from '../model/sidebar-store';
import { type ShellSurfaces, useShellSurfaces } from '../model/use-shell-surfaces';
import { BottomBar } from './bottom-bar';
import { CommandPalette } from './command-palette';
import { SHELL_FRAME } from './shell-frame';
import { ShellHeader } from './shell-header';
import { ShortcutsDialog } from './shortcuts-dialog';
import { Sidebar } from './sidebar';

export type AppShellProps = Readonly<{ initial: SidebarState; children: ReactNode }>;

const ITEMS = visibleNavItems(FEATURE_FLAGS);

const SKIP_LINK =
  'sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2.5 focus:text-[13.5px] focus:font-semibold focus:text-ink focus:shadow-e2';

function ShellSurfacesLayer({ surfaces }: Readonly<{ surfaces: ShellSurfaces }>) {
  return (
    <>
      <CommandPalette surfaces={surfaces} />
      <ShortcutsDialog
        state={{
          open: surfaces.surface === 'shortcuts',
          onOpenChange: (open) => {
            if (!open) surfaces.closeThen();
          },
        }}
        shortcuts={shortcutsOf(FEATURE_FLAGS)}
        singleKeys={useSingleKeyShortcuts()}
        handlers={{ onCloseAutoFocus: surfaces.onCloseAutoFocus }}
      />
    </>
  );
}

export function AppShell({ initial, children }: AppShellProps) {
  const surfaces = useShellSurfaces();
  const pathname = usePathname();
  const nav: ShellNav = {
    items: ITEMS,
    activeHref: activeHrefOf(pathname, ITEMS),
    badges: { silent: useSilentCount() },
  };
  return (
    <SidebarStoreProvider initial={initial}>
      <PageCommandsProvider>
        <div data-app-shell className="flex min-h-dvh">
          <a href="#main" className={SKIP_LINK}>
            {uk.shell.skipToContent}
          </a>
          <Sidebar nav={nav} />
          <div className="flex min-w-0 flex-1 flex-col">
            <ShellHeader title={shellTitleOf(pathname, ITEMS)} />
            <main
              id="main"
              tabIndex={-1}
              className={cn(
                SHELL_FRAME.main,
                'pb-[calc(var(--spacing)*18_+_env(safe-area-inset-bottom))]',
              )}
            >
              {children}
            </main>
          </div>
          <BottomBar nav={nav} />
        </div>
        <ShellSurfacesLayer surfaces={surfaces} />
      </PageCommandsProvider>
    </SidebarStoreProvider>
  );
}
