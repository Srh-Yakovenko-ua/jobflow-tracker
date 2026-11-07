import { cn } from '@/shared/lib/cn';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

export const SHELL_FRAME = {
  header:
    'flex flex-wrap items-center gap-x-5 gap-y-3 bg-paper px-4 py-3 shadow-[0_1px_0_var(--line-soft)] md:px-6.5',
  search: 'order-last w-full md:order-none md:ms-auto md:w-auto md:max-w-80 md:min-w-44 md:flex-1',
  avatar: cn('size-8 rounded-pill max-md:min-w-11', TOUCH_HEIGHT),
  main: 'flex-1 px-4 pt-4 md:p-6.5',
} as const;
