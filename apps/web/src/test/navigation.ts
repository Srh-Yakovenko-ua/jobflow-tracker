import { vi } from 'vitest';

export const push = vi.fn<(href: string) => void>();

export const replace = vi.fn<(href: string) => void>();

function boardPathname(): string {
  return '/board';
}

function stubRouter() {
  return { push, replace, prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() };
}

export { boardPathname as usePathname, stubRouter as useRouter };
