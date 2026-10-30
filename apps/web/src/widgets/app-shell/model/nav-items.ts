import {
  AlarmClock,
  CalendarDays,
  ChartColumn,
  FileText,
  type LucideIcon,
  Settings,
  SquareKanban,
} from 'lucide-react';

import type { FeatureFlag, FeatureFlags } from '@/shared/config';
import type { uk } from '@/shared/i18n';

export type NavItemId = keyof typeof uk.shell.nav;

export type NavBadge = 'silent';

export type NavItem = Readonly<{
  id: NavItemId;
  href: string;
  icon: LucideIcon;
  flag?: FeatureFlag;
  badge?: NavBadge;
}>;

export type ShellNav = Readonly<{
  items: readonly NavItem[];
  activeHref: string | undefined;
  badges: Readonly<Record<NavBadge, number>>;
}>;

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'board', href: '/board', icon: SquareKanban, badge: 'silent' },
  { id: 'analytics', href: '/analytics', icon: ChartColumn, flag: 'analytics' },
  { id: 'calendar', href: '/calendar', icon: CalendarDays, flag: 'calendar' },
  { id: 'resumes', href: '/resumes', icon: FileText, flag: 'resumes' },
  { id: 'reminders', href: '/reminders', icon: AlarmClock, flag: 'reminders' },
  { id: 'settings', href: '/settings', icon: Settings, flag: 'settings' },
];

export function visibleNavItems(flags: FeatureFlags): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.flag === undefined || flags[item.flag]);
}

export function activeHrefOf(pathname: string, items: readonly NavItem[]): string | undefined {
  return items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;
}

export function navStatusOf(nav: ShellNav, item: NavItem) {
  return {
    active: nav.activeHref === item.href,
    count: item.badge === undefined ? 0 : nav.badges[item.badge],
  };
}
