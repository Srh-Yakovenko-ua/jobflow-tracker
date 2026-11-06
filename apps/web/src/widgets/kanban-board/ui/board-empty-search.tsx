import { FiltersEmptyState, type FiltersEmptyStateProps } from '@/features/filter-applications';
import { cn } from '@/shared/lib/cn';

import { BOARD_FRAME } from './column-frame';

export function BoardEmptySearch({ q }: FiltersEmptyStateProps) {
  return (
    <div className={cn(BOARD_FRAME.width, 'animate-fade-in p-1')}>
      <FiltersEmptyState q={q} />
    </div>
  );
}
