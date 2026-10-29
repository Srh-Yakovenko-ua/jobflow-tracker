import { cn } from '@/shared/lib/cn';

const BOX =
  'rounded-md bg-surface-2 text-body text-ink shadow-flat transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard data-invalid:bg-danger/4 data-invalid:inset-ring data-invalid:inset-ring-danger/60 data-disabled:cursor-not-allowed data-disabled:border-[1.5px] data-disabled:border-dashed data-disabled:border-line data-disabled:bg-surface-3 data-disabled:text-ink-3 data-disabled:shadow-none';

export const FIELD_SURFACE = {
  shell: cn(
    BOX,
    'relative flex min-w-0 items-center has-[[data-focus=halo]:focus-visible]:bg-surface has-[[data-focus=halo]:focus-visible]:focus-halo has-[[data-focus=halo][data-state=open]]:bg-surface has-[[data-focus=halo][data-state=open]]:focus-halo',
  ),
  self: cn(BOX, 'focus-visible:bg-surface focus-visible:focus-halo'),
  control:
    'h-full min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-ink-3 disabled:cursor-not-allowed',
  trigger:
    'flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-hidden after:absolute after:inset-0 disabled:cursor-not-allowed',
  height: { field: 'h-control-md', trigger: 'h-9.5 rounded-[10px]' },
} as const;

export type SelectOption = { value: string; label: string; meta?: string; detail?: string };

export type SelectOptionGroup = { label?: string; options: readonly SelectOption[] };

export const MENU_SURFACE =
  'z-50 flex flex-col gap-px overflow-y-auto rounded-lg bg-surface p-1.5 font-ui text-ink shadow-e2 inset-ring inset-ring-line-soft animate-pop-in';

export const CHOICE_ROW =
  'flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-body text-ink has-disabled:cursor-not-allowed has-disabled:text-ink-3';

export const CHECK_BOX = {
  base: 'flex size-4.5 flex-none items-center justify-center rounded-[6px] transition-colors duration-(--duration-instant) ease-standard',
  off: 'bg-surface inset-ring-[1.5px] inset-ring-ink-3/30',
  on: 'bg-accent text-surface',
} as const;

export const OPTION_ROW =
  'flex min-h-9 cursor-pointer items-center gap-2.25 rounded-md py-1.5 pr-2.5 pl-2.25 text-[13px] text-ink outline-hidden transition-colors duration-(--duration-instant) ease-standard';

export const MENU_LABEL =
  'px-2.5 pt-1.5 pb-1.25 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase';
