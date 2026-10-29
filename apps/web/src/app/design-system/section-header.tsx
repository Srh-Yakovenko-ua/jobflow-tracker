import { cn } from '@/shared/lib/cn';

const HEADER_SIZES = {
  lead: {
    row: 'gap-4',
    index: 'text-[12px]',
    title: 'font-display text-[27px] leading-[normal] font-medium tracking-[-0.02em]',
  },
  section: {
    row: 'gap-3.5',
    index: 'text-[11px]',
    title: 'font-display text-display leading-[normal]',
  },
};

export type SectionHeaderProps = {
  header: { index: string; title: string };
  size: keyof typeof HEADER_SIZES;
};

export function SectionHeader({ header, size }: SectionHeaderProps) {
  const classes = HEADER_SIZES[size];
  return (
    <div className={cn('flex flex-wrap items-baseline leading-[normal]', classes.row)}>
      <span
        className={cn(
          'font-display font-medium tracking-[0.16em] text-ink-3 tabular-nums',
          classes.index,
        )}
      >
        {header.index}
      </span>
      <h2 className={classes.title}>{header.title}</h2>
      <span aria-hidden className="h-px min-w-10 flex-1 bg-line" />
    </div>
  );
}
