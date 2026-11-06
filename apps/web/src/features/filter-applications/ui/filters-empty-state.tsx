import { uk } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui/empty-state';

import { FilterChips, ResetFiltersButton } from './filter-chips';

const COPY = uk.board.emptySearch;

export type FiltersEmptyStateProps = Readonly<{ q: string | undefined }>;

export function FiltersEmptyState({ q }: FiltersEmptyStateProps) {
  const content = {
    eyebrow: COPY.eyebrow,
    title: q === undefined ? COPY.filteredTitle : COPY.title(q),
    hint: COPY.hint,
  };
  return (
    <div className="max-w-120">
      <EmptyState
        content={content}
        slots={{
          figure: <FilterChips />,
          action: <ResetFiltersButton look={{ variant: 'secondary', size: 'md' }} />,
        }}
      />
    </div>
  );
}
