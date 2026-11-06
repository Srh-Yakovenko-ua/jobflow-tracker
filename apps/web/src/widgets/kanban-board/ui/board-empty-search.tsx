import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { EmptyState } from '@/shared/ui/empty-state';

import { BOARD_FRAME } from './column-frame';
import { FilterChips, ResetFiltersButton } from './filter-chips';

const COPY = uk.board.emptySearch;

export type BoardEmptySearchProps = Readonly<{ q: string | undefined }>;

export function BoardEmptySearch({ q }: BoardEmptySearchProps) {
  const content = {
    eyebrow: COPY.eyebrow,
    title: q === undefined ? COPY.filteredTitle : COPY.title(q),
    hint: COPY.hint,
  };
  return (
    <div className={cn(BOARD_FRAME.width, 'animate-fade-in p-1')}>
      <div className="max-w-120">
        <EmptyState
          content={content}
          slots={{
            figure: <FilterChips />,
            action: <ResetFiltersButton look={{ variant: 'secondary', size: 'md' }} />,
          }}
        />
      </div>
    </div>
  );
}
