import { startTransition, useEffect, useState } from 'react';
import { vi } from 'vitest';

export const push = vi.fn<(href: string) => void>();

export const replace = vi.fn<(href: string) => void>();

export const back = vi.fn<() => void>();

export const route = { pathname: '/board' };

const searchListeners = new Set<() => void>();

const replaceAddress = window.history.replaceState.bind(window.history);

function currentPathname(): string {
  return route.pathname;
}

function stubRouter() {
  return { push, replace, prefetch: vi.fn(), back, forward: vi.fn() };
}

function notifySearchListeners(): void {
  searchListeners.forEach((listener) => {
    listener();
  });
}

window.history.replaceState = (...args: Parameters<History['replaceState']>) => {
  replaceAddress(...args);
  startTransition(notifySearchListeners);
};

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
  const [search, setSearch] = useState(currentSearch);
  useEffect(
    () =>
      subscribeToSearch(() => {
        setSearch(currentSearch());
      }),
    [],
  );
  return new URLSearchParams(search);
}

export function navigateTo(href: string): void {
  window.history.pushState(null, '', href);
  route.pathname = window.location.pathname;
  notifySearchListeners();
}

export { currentPathname as usePathname, stubRouter as useRouter };
