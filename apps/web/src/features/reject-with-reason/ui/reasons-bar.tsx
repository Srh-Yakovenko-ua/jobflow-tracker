import { REJECTION_REASONS, type RejectionReasonsSummary } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

export type ReasonsBarProps = Readonly<{ reasons: RejectionReasonsSummary['reasons'] }>;

export function ReasonsBar({ reasons }: ReasonsBarProps) {
  const counts = reasons.map((reason) => reason.count);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const top = Math.max(...counts);
  return (
    <ul className="grid grid-cols-[150px_1fr_28px] items-center gap-x-3 gap-y-2.25 text-[13px]">
      {reasons.map(({ code, count }) => (
        <li
          key={code}
          className={cn(
            'col-span-3 grid grid-cols-subgrid items-center',
            count === top ? 'text-ink' : 'text-ink-2',
          )}
        >
          <span>{REJECTION_REASONS[code].labelUk}</span>
          <span aria-hidden className="block h-4 overflow-hidden rounded-xs bg-line-soft">
            <span
              className={cn('block h-4 rounded-xs', count === top ? 'bg-data-2' : 'bg-data-6')}
              style={{ width: `${String((count / total) * 100)}%` }}
            />
          </span>
          <span className={cn('text-right tabular-nums', count === top && 'font-semibold')}>
            {count}
          </span>
        </li>
      ))}
    </ul>
  );
}
