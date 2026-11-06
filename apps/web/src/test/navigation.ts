import { vi } from 'vitest';

export const push = vi.fn<(href: string) => void>();

export const replace = vi.fn<(href: string) => void>();

export const back = vi.fn<() => void>();

export const route = { pathname: '/board' };

function currentPathname(): string {
  return route.pathname;
}

function stubRouter() {
  return { push, replace, prefetch: vi.fn(), back, forward: vi.fn() };
}

export { currentPathname as usePathname, stubRouter as useRouter };
