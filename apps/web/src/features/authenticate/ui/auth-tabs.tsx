import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { AUTH_MODES, type AuthMode } from '../model/auth-modes';

export type AuthTabsProps = Readonly<{ mode: AuthMode }>;

const TAB_ORDER: readonly AuthMode[] = ['register', 'login'];

const TAB =
  'touch-target flex h-[42px] items-center justify-center px-3.5 pb-2.5 text-[14.5px] transition-colors duration-(--duration-instant) ease-standard';

const CURRENT = '-mb-px border-b-2 border-ink font-semibold text-ink';

const IDLE = 'text-ink-3 hover:text-ink active:text-ink';

export function AuthTabs({ mode }: AuthTabsProps) {
  return (
    <nav aria-label={uk.auth.tabsLabel} className="flex shadow-[inset_0_-1px_0_var(--line-soft)]">
      {TAB_ORDER.map((tab) => (
        <Link
          key={tab}
          href={AUTH_MODES[tab].href}
          aria-current={tab === mode ? 'page' : undefined}
          className={cn(TAB, tab === mode ? CURRENT : IDLE)}
        >
          {AUTH_MODES[tab].copy.title}
        </Link>
      ))}
    </nav>
  );
}
