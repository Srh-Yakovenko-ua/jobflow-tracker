'use client';

import type { AuthUser } from '@jobflow/shared';
import { LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';

import { initialsOf, useSession } from '@/entities/user';
import { ThemeMenuItems } from '@/features/switch-theme';
import { FEATURE_FLAGS } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  DANGER_MENU_ITEM,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/shared/ui/menu';

const AVATAR =
  'flex flex-none items-center justify-center rounded-pill bg-linear-140 from-accent to-accent-press font-semibold text-surface';

function UserCard({ user }: Readonly<{ user: AuthUser }>) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
      <span aria-hidden className={cn(AVATAR, 'size-8.5 text-[12.5px]')}>
        {initialsOf(user)}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[13px] font-semibold text-ink">
          {user.displayName ?? user.email}
        </span>
        <span className="caption truncate text-ink-3">{user.email}</span>
      </span>
    </div>
  );
}

export function UserMenu() {
  const { user, logout } = useSession();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={uk.shell.userMenu}
          className={cn(AVATAR, 'touch-target size-8 text-[12px] data-[state=open]:shadow-focus')}
        >
          {user ? initialsOf(user) : <User aria-hidden />}
        </button>
      </MenuTrigger>
      <MenuContent>
        {user && <UserCard user={user} />}
        {user && <MenuSeparator />}
        {FEATURE_FLAGS.settings && (
          <MenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden />
              {uk.shell.nav.settings}
            </Link>
          </MenuItem>
        )}
        <ThemeMenuItems />
        <MenuSeparator />
        <MenuItem className={DANGER_MENU_ITEM} onSelect={logout}>
          <LogOut aria-hidden size={16} strokeWidth={1.9} />
          {uk.shell.logout.label}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
