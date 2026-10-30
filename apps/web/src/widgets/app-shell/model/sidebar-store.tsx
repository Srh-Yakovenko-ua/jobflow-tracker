'use client';

import { createContext, type ReactNode, use, useState } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { writeCookie } from '@/shared/lib/cookie';

import { SIDEBAR_COOKIE, sidebarCookieOf, type SidebarState } from './sidebar-cookie';

export type SidebarStore = SidebarState & { toggle: () => void };

export function createSidebarStore(initial: SidebarState) {
  return createStore<SidebarStore>()((set, get) => ({
    ...initial,
    toggle: () => {
      const next = { collapsed: !get().collapsed };
      writeCookie({ name: SIDEBAR_COOKIE, value: sidebarCookieOf(next) });
      set(next);
    },
  }));
}

type SidebarStoreApi = ReturnType<typeof createSidebarStore>;

const SidebarStoreContext = createContext<SidebarStoreApi | null>(null);

export type SidebarStoreProviderProps = Readonly<{ initial: SidebarState; children: ReactNode }>;

export function SidebarStoreProvider({ initial, children }: SidebarStoreProviderProps) {
  const [store] = useState(() => createSidebarStore(initial));
  return <SidebarStoreContext value={store}>{children}</SidebarStoreContext>;
}

export function useSidebarStore<Picked>(selector: (store: SidebarStore) => Picked): Picked {
  const store = use(SidebarStoreContext);
  if (!store) {
    throw new Error('useSidebarStore must be used inside SidebarStoreProvider');
  }
  return useStore(store, selector);
}
