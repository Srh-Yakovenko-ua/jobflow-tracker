import type { ReactNode } from 'react';

import { GlobalSearch } from '@/features/search-applications';
import { FEATURE_FLAGS } from '@/shared/config';
import { cn } from '@/shared/lib/cn';

import { AddApplicationLink } from './add-application-link';
import { SHELL_FRAME } from './shell-frame';
import { UserMenu } from './user-menu';

export type ShellTitle = Readonly<{ text: string; heading: boolean }>;

export type ShellHeaderProps = Readonly<{ title: ShellTitle | undefined; actions?: ReactNode }>;

const TITLE =
  'min-w-0 flex-1 truncate font-display text-display text-ink md:flex-none md:text-[30px]/[1.05] md:font-medium md:tracking-[-0.042em]';

function ShellTitleText({ title }: Readonly<{ title: ShellTitle }>) {
  const Tag = title.heading ? 'h1' : 'p';
  return <Tag className={TITLE}>{title.text}</Tag>;
}

export function ShellHeader({ title, actions }: ShellHeaderProps) {
  return (
    <header className={cn(SHELL_FRAME.header, 'z-30 md:sticky md:top-0')}>
      {title !== undefined && <ShellTitleText title={title} />}
      <div className={SHELL_FRAME.search}>
        <GlobalSearch />
      </div>
      <div className="flex flex-none items-center gap-3 max-md:ms-auto">
        {FEATURE_FLAGS.addApplication && <AddApplicationLink />}
        {actions}
        <UserMenu />
      </div>
    </header>
  );
}
