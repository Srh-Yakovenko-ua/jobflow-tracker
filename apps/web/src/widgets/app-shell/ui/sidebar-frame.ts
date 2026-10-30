import { cn } from '@/shared/lib/cn';

import type { SidebarState } from '../model/sidebar-cookie';

const FRAME =
  'sticky top-0 hidden h-dvh flex-none bg-paper shadow-[1px_0_0_var(--line-soft)] md:flex';

const WIDTH = { collapsed: 'w-18', expanded: 'w-60' } as const;

export function sidebarFrameOf({ collapsed }: SidebarState): string {
  return cn(FRAME, collapsed ? WIDTH.collapsed : WIDTH.expanded);
}
