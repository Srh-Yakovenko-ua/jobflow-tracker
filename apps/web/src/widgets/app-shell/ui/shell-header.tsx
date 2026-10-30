import { GlobalSearch } from '@/features/search-applications';
import { FEATURE_FLAGS } from '@/shared/config';
import { cn } from '@/shared/lib/cn';

import { AddApplicationLink } from './add-application-link';
import { SHELL_FRAME } from './shell-frame';
import { UserMenu } from './user-menu';

export type ShellHeaderProps = Readonly<{ title: string | undefined }>;

export function ShellHeader({ title }: ShellHeaderProps) {
  return (
    <header className={cn(SHELL_FRAME.header, 'z-30 md:sticky md:top-0')}>
      {title !== undefined && (
        <h1 className="min-w-0 flex-1 truncate font-display text-display text-ink md:flex-none md:text-[30px]/[1.05] md:font-medium md:tracking-[-0.042em]">
          {title}
        </h1>
      )}
      <div className={SHELL_FRAME.search}>
        <GlobalSearch />
      </div>
      <div className="flex flex-none items-center gap-3 max-md:ms-auto">
        {FEATURE_FLAGS.addApplication && <AddApplicationLink />}
        <UserMenu />
      </div>
    </header>
  );
}
