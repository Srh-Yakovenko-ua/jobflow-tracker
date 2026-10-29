import { cn } from '@/shared/lib/cn';

export type SpinnerProps = Readonly<{ className?: string | undefined }>;

export function Spinner({ className }: SpinnerProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3.5 flex-none animate-spin rounded-pill border-2 border-current/35 border-t-current [animation-duration:700ms]',
        className,
      )}
    />
  );
}
