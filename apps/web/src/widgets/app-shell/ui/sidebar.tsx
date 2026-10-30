'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

import type { ShellNav } from '../model/nav-items';
import { useSidebarStore } from '../model/sidebar-store';
import { NavList } from './nav-list';

export type SidebarProps = Readonly<{ nav: ShellNav }>;

export function Sidebar({ nav }: SidebarProps) {
  const collapsed = useSidebarStore((store) => store.collapsed);
  const toggle = useSidebarStore((store) => store.toggle);
  return (
    <nav
      aria-label={uk.shell.navLabel}
      className={cn(
        'sticky top-0 hidden h-dvh flex-none flex-col gap-5 bg-paper px-3 py-4 shadow-[1px_0_0_var(--line-soft)] ease-standard motion-safe:transition-[width] motion-safe:duration-(--duration-base) md:flex',
        collapsed ? 'w-18' : 'w-60',
      )}
    >
      <div className={cn('flex h-9 items-center', collapsed ? 'justify-center' : 'ps-3')}>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold tracking-[-0.035em] text-ink">
            {uk.app.brand}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          aria-label={collapsed ? uk.shell.expand : uk.shell.collapse}
          aria-expanded={!collapsed}
          onClick={toggle}
        />
      </div>
      <NavList nav={nav} variant={collapsed ? 'rail' : 'sidebar'} className="flex-col gap-0.5" />
    </nav>
  );
}
