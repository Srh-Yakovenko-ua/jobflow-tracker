import { SearchX } from 'lucide-react';

import { uk } from '@/shared/i18n';

export function NoMatches() {
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-2.5 pt-4 pb-3 text-center">
      <span
        aria-hidden
        className="flex size-6.5 items-center justify-center rounded-md bg-surface-2 text-ink-3"
      >
        <SearchX size={15} />
      </span>
      <span className="text-[12.5px] text-ink-3">{uk.ui.noMatches}</span>
    </div>
  );
}
