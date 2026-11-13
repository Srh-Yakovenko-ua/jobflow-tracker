import { cn } from '@/shared/lib/cn';

export type SwatchProps = Readonly<{ fill: string }>;

export function Swatch({ fill }: SwatchProps) {
  return <span aria-hidden className={cn('h-2.25 w-3 flex-none rounded-[3px]', fill)} />;
}
