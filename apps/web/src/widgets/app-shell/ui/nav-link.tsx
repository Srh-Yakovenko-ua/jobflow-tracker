'use client';

import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { COUNT_PILL } from '@/shared/ui/count-pill';
import { Tooltip } from '@/shared/ui/tooltip';

import type { NavItem } from '../model/nav-items';

export type NavLinkVariant = 'sidebar' | 'rail' | 'bar';

export type NavLinkStatus = Readonly<{ active: boolean; count: number }>;

export type NavLinkProps = Readonly<{
  item: NavItem;
  status: NavLinkStatus;
  variant: NavLinkVariant;
}>;

type VariantLook = { link: string; label: string; count: string; marker: string };

const START_MARKER = 'inset-y-2 start-0 w-0.75 rounded-e-xs';

const VARIANTS: Record<NavLinkVariant, VariantLook> = {
  sidebar: {
    link: 'h-9 gap-2.5 rounded-md px-3 text-[13.5px]',
    label: 'min-w-0 flex-1 animate-fade-in truncate',
    count: 'animate-fade-in text-[11.5px] tabular-nums',
    marker: START_MARKER,
  },
  rail: {
    link: 'h-9 justify-center rounded-md',
    label: 'sr-only',
    count: cn(COUNT_PILL, 'absolute end-0.5 -top-1'),
    marker: START_MARKER,
  },
  bar: {
    link: 'h-14 w-full min-w-0 flex-col justify-center gap-1 px-1 text-[10.5px]',
    label: 'max-w-full truncate',
    count: cn(COUNT_PILL, 'absolute start-[calc(50%+4px)] top-1.5'),
    marker: 'inset-x-4 top-0 h-0.75 rounded-b-xs',
  },
};

const BASE =
  'touch-target relative flex items-center font-medium transition-colors duration-(--duration-fast) ease-standard';

const ACTIVE = 'bg-accent-tint font-semibold text-accent-ink [&>svg]:text-accent';

const IDLE = 'text-ink-2 hover:bg-surface hover:text-ink active:bg-surface-3 [&>svg]:text-ink-3';

export function NavLink({ item, status, variant }: NavLinkProps) {
  const look = VARIANTS[variant];
  const label = uk.shell.nav[item.id];
  const Icon = item.icon;
  const badge = status.count > 0 ? uk.shell.silentBadge(status.count) : null;
  const link = (
    <Link
      href={item.href}
      aria-current={status.active ? 'page' : undefined}
      className={cn(BASE, look.link, status.active ? ACTIVE : IDLE)}
    >
      {status.active && (
        <span data-marker aria-hidden className={cn('absolute bg-accent', look.marker)} />
      )}
      <Icon aria-hidden className="flex-none" />
      <span className={look.label}>{label}</span>
      {badge !== null && (
        <>
          {' '}
          <span className="sr-only">{badge}</span>
          <span aria-hidden title={badge} className={look.count}>
            {status.count}
          </span>
        </>
      )}
    </Link>
  );
  if (variant !== 'rail') return link;
  return (
    <Tooltip content={badge === null ? label : `${label} · ${badge}`} side="right">
      {link}
    </Tooltip>
  );
}
