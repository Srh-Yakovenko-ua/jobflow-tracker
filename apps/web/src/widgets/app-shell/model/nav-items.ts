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
import { uk } from '@/shared/i18n';

export type NavItemId = keyof typeof uk.shell.nav;

export type NavBadge = 'silent';

export type NavAlias = Readonly<{ href: string; title: string }>;

export type NavItem = Readonly<{
  id: NavItemId;
  href: string;
  icon: LucideIcon;
  flag?: FeatureFlag;
  badge?: NavBadge;
  aliases?: readonly NavAlias[];
}>;

export type ShellNav = Readonly<{
  items: readonly NavItem[];
  activeHref: string | undefined;
  badges: Readonly<Record<NavBadge, number>>;
}>;

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'board',
    href: '/board',
    icon: SquareKanban,
    badge: 'silent',
    aliases: [{ href: '/applications', title: uk.applicationsTable.title }],
  },
  { id: 'analytics', href: '/analytics', icon: ChartColumn, flag: 'analytics' },
  { id: 'calendar', href: '/calendar', icon: CalendarDays, flag: 'calendar' },
  { id: 'resumes', href: '/resumes', icon: FileText, flag: 'resumes' },
  { id: 'reminders', href: '/reminders', icon: AlarmClock, flag: 'reminders' },
  { id: 'settings', href: '/settings', icon: Settings, flag: 'settings' },
];

export function isFlagOn(flags: FeatureFlags, flag: FeatureFlag | undefined): boolean {
  return flag === undefined || flags[flag];
}

export function visibleNavItems(flags: FeatureFlags): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => isFlagOn(flags, item.flag));
}

function activeItemOf(pathname: string, items: readonly NavItem[]): NavItem | undefined {
  return items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function activeHrefOf(pathname: string, items: readonly NavItem[]): string | undefined {
  return activeItemOf(pathname, items)?.href;
}

export function shellTitleOf(pathname: string, items: readonly NavItem[]): string | undefined {
  const item = activeItemOf(pathname, items);
  if (item !== undefined) return uk.shell.nav[item.id];
  return items
    .flatMap((candidate) => candidate.aliases ?? [])
    .find((alias) => alias.href === pathname)?.title;
}

export function navStatusOf(nav: ShellNav, item: NavItem) {
  return {
    active: nav.activeHref === item.href,
    count: item.badge === undefined ? 0 : nav.badges[item.badge],
  };
}
