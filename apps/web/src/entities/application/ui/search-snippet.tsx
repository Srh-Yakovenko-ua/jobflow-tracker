import type { SearchSnippet as SnippetParts } from '@jobflow/shared';
import { Fragment } from 'react';

import { cn } from '@/shared/lib/cn';
import { OPTION_CAPTION } from '@/shared/ui/option-content';

export type SearchSnippetProps = Readonly<{ snippet: SnippetParts }>;

function placedPartsOf(snippet: SnippetParts) {
  return snippet.map((part, index) => ({
    part,
    start: snippet.slice(0, index).reduce((length, before) => length + before.text.length, 0),
  }));
}

export function SearchSnippet({ snippet }: SearchSnippetProps) {
  return (
    <span className={cn(OPTION_CAPTION, 'line-clamp-2 wrap-anywhere')}>
      {placedPartsOf(snippet).map(({ part, start }) =>
        part.match ? (
          <mark key={start} className="bg-transparent font-semibold text-ink">
            {part.text}
          </mark>
        ) : (
          <Fragment key={start}>{part.text}</Fragment>
        ),
      )}
    </span>
  );
}
