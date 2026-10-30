import { GlobalSearch } from '@/features/search-applications';
import { FEATURE_FLAGS } from '@/shared/config';

import { AddApplicationLink } from './add-application-link';
import { UserMenu } from './user-menu';

export type ShellHeaderProps = Readonly<{ title: string | undefined }>;

export function ShellHeader({ title }: ShellHeaderProps) {
  return (
    <header className="z-30 flex flex-wrap items-center gap-x-5 gap-y-3 bg-paper px-4 py-3 shadow-[0_1px_0_var(--line-soft)] md:sticky md:top-0 md:px-6.5">
      {title !== undefined && (
        <h1 className="min-w-0 flex-1 truncate font-display text-display text-ink md:flex-none md:text-[30px]/[1.05] md:font-medium md:tracking-[-0.042em]">
          {title}
        </h1>
      )}
      <div className="order-last w-full md:order-none md:ms-auto md:w-auto md:max-w-80 md:min-w-44 md:flex-1">
        <GlobalSearch />
      </div>
      <div className="flex flex-none items-center gap-3 max-md:ms-auto">
        {FEATURE_FLAGS.addApplication && <AddApplicationLink />}
        <UserMenu />
      </div>
    </header>
  );
}
