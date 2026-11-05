import type { ApplicationCard } from '@jobflow/shared';
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

import type { CardDensity } from '@/entities/application';

import { COLUMN_VIRTUAL } from './column-virtual';
import { type DragSource, isLanding } from './drag-source';

export type ColumnVirtualizerOptions = Readonly<{
  items: readonly ApplicationCard[];
  density: CardDensity;
  source: DragSource;
}>;

function isPinned(application: ApplicationCard, source: DragSource): boolean {
  return (
    application.id === source.activeId ||
    application.id === source.focusId ||
    isLanding(application, source.landing)
  );
}

function pinnedIndexesOf(items: readonly ApplicationCard[], source: DragSource): number[] {
  return items.flatMap((application, index) => (isPinned(application, source) ? [index] : []));
}

function withPinned(range: Range, pinned: readonly number[]): number[] {
  const shown = new Set([...defaultRangeExtractor(range), ...pinned]);
  return [...shown].sort((left, right) => left - right);
}

export function useColumnVirtualizer({ items, density, source }: ColumnVirtualizerOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = pinnedIndexesOf(items, source);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COLUMN_VIRTUAL.estimate[density],
    gap: COLUMN_VIRTUAL.gap,
    overscan: COLUMN_VIRTUAL.overscan,
    getItemKey: (index) => `${density}:${items[index]?.id ?? String(index)}`,
    rangeExtractor: (range) => withPinned(range, pinned),
  });
  const rows = virtualizer.getVirtualItems();
  const lastShown = virtualizer.range?.endIndex ?? items.length - 1;
  return {
    rows,
    totalSize: virtualizer.getTotalSize(),
    below: items.length - 1 - lastShown,
    measureElement: virtualizer.measureElement,
    scrollRef,
  };
}
