import { uk } from '@/shared/i18n';

import type { ShellNav } from '../model/nav-items';
import { NavList } from './nav-list';

export type BottomBarProps = Readonly<{ nav: ShellNav }>;

export function BottomBar({ nav }: BottomBarProps) {
  const items = nav.items.filter((item) => item.id !== 'settings');
  return (
    <nav
      aria-label={uk.shell.bottomNavLabel}
      className="fixed inset-x-0 bottom-0 z-30 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line-soft)] md:hidden"
    >
      <NavList nav={{ ...nav, items }} variant="bar" className="h-14" />
    </nav>
  );
}
