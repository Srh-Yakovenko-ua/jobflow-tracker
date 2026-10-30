import { z } from 'zod';

export const SIDEBAR_COOKIE = 'jobflow_sidebar';

const sidebarCookieSchema = z.enum(['expanded', 'collapsed']).catch('expanded');

export type SidebarState = Readonly<{ collapsed: boolean }>;

export function sidebarFromCookie(value: string | undefined): SidebarState {
  return { collapsed: sidebarCookieSchema.parse(value) === 'collapsed' };
}

export function sidebarCookieOf({ collapsed }: SidebarState): string {
  return collapsed ? 'collapsed' : 'expanded';
}
