import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { sidebarFromCookie } from './sidebar-cookie';
import {
  createSidebarStore,
  type SidebarStore,
  SidebarStoreProvider,
  useSidebarStore,
} from './sidebar-store';

describe('createSidebarStore', () => {
  it('toggle collapses the sidebar and remembers it in the cookie, a second toggle expands it', () => {
    const store = createSidebarStore({ collapsed: false });

    store.getState().toggle();
    expect(store.getState().collapsed).toBe(true);
    expect(document.cookie).toContain('jobflow_sidebar=collapsed');

    store.getState().toggle();
    expect(store.getState().collapsed).toBe(false);
    expect(document.cookie).toContain('jobflow_sidebar=expanded');
  });
});

describe('sidebarFromCookie', () => {
  it.each([
    ['collapsed', true],
    ['expanded', false],
    [undefined, false],
    ['wide', false],
  ])('reads %s as collapsed %s', (value, collapsed) => {
    expect(sidebarFromCookie(value)).toEqual({ collapsed });
  });
});

function CollapsedSidebar({ children }: Readonly<{ children: ReactNode }>) {
  return <SidebarStoreProvider initial={{ collapsed: true }}>{children}</SidebarStoreProvider>;
}

function isCollapsed(store: SidebarStore): boolean {
  return store.collapsed;
}

describe('SidebarStoreProvider', () => {
  it('seeds the store with the state the server read from the cookie', () => {
    const { result } = renderHook(() => useSidebarStore(isCollapsed), {
      wrapper: CollapsedSidebar,
    });

    expect(result.current).toBe(true);
  });
});
