import { cn } from '@/shared/lib/cn';
import { FIELD_SURFACE } from '@/shared/ui/field-surface';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { TextSkeleton } from '@/shared/ui/skeleton';

import type { SidebarState } from '../model/sidebar-cookie';
import { SHELL_FRAME } from './shell-frame';
import { sidebarFrameOf } from './sidebar-frame';

export type ShellSkeletonProps = Readonly<{ initial: SidebarState }>;

const PLACEHOLDER = 'flex-none bg-surface-2 shadow-flat';

export function ShellSkeleton({ initial }: ShellSkeletonProps) {
  return (
    <LoadingRegion className="flex min-h-dvh">
      <div aria-hidden className={sidebarFrameOf(initial)} />
      <div aria-hidden className="flex min-w-0 flex-1 flex-col">
        <div className={cn(SHELL_FRAME.header, 'justify-end')}>
          <span
            className={cn(
              PLACEHOLDER,
              SHELL_FRAME.search,
              FIELD_SURFACE.height.field,
              'rounded-md',
            )}
          />
          <span className={cn(PLACEHOLDER, SHELL_FRAME.avatar)} />
        </div>
        <div className={SHELL_FRAME.main}>
          <div className="max-w-140 bg-surface p-5 shadow-e1">
            <TextSkeleton />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
