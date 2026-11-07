import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

export const push = vi.fn<(href: string) => void>();

export const replace = vi.fn<(href: string) => void>();

export const back = vi.fn<() => void>();

export const route = { pathname: '/board' };

const searchListeners = new Set<() => void>();

function currentPathname(): string {
  return route.pathname;
}

function stubRouter() {
  return { push, replace, prefetch: vi.fn(), back, forward: vi.fn() };
}

function subscribeToSearch(listener: () => void) {
  searchListeners.add(listener);
  return () => {
    searchListeners.delete(listener);
  };
}

function currentSearch(): string {
  return window.location.search;
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useSyncExternalStore(subscribeToSearch, currentSearch));
}

export function navigateTo(href: string): void {
  window.history.pushState(null, '', href);
  route.pathname = window.location.pathname;
  searchListeners.forEach((listener) => {
    listener();
  });
}

export { currentPathname as usePathname, stubRouter as useRouter };
