'use client';

import { createStore } from 'zustand/vanilla';

import { writeCookie } from '@/shared/lib/cookie';
import { createStoreContext } from '@/shared/lib/store-context';

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

const { Provider, useStoreSelector } = createStoreContext({
  name: 'SidebarStore',
  create: createSidebarStore,
});

export { Provider as SidebarStoreProvider, useStoreSelector as useSidebarStore };
