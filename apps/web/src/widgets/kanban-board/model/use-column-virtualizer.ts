import type { ApplicationCard } from '@jobflow/shared';
import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
  type Virtualizer,
} from '@tanstack/react-virtual';
import { type FocusEvent, useLayoutEffect, useRef, useState } from 'react';

import type { CardDensity } from '@/entities/application';

import { COLUMN_VIRTUAL } from './column-virtual';
import { type DragSource, isLanding } from './drag-source';

export type ColumnVirtualizerOptions = Readonly<{
  items: readonly ApplicationCard[];
  density: CardDensity;
  source: DragSource;
}>;

type ColumnScroll = Pick<Virtualizer<HTMLDivElement, Element>, 'scrollToIndex'>;

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

function reachAround(index: number, count: number): number[] {
  if (index < 0) return [];
  const first = Math.max(0, index - COLUMN_VIRTUAL.focusReach);
  const last = Math.min(count - 1, index + COLUMN_VIRTUAL.focusReach);
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

function useFocusedRow(items: readonly ApplicationCard[]) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const onFocus = ({ target }: FocusEvent) => {
    const row = target.closest<HTMLElement>('[data-index]');
    setFocusedId(items[Number(row?.dataset.index)]?.id ?? null);
  };
  const focusedIndex = items.findIndex((application) => application.id === focusedId);
  return { reach: reachAround(focusedIndex, items.length), onFocus };
}

function useLandingScroll(scroll: ColumnScroll, landingIndex: number) {
  useLayoutEffect(() => {
    if (landingIndex < 0) return;
    scroll.scrollToIndex(landingIndex, { align: 'auto', behavior: 'instant' });
  }, [landingIndex, scroll]);
}

export function useColumnVirtualizer({ items, density, source }: ColumnVirtualizerOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focused = useFocusedRow(items);
  const pinned = [...pinnedIndexesOf(items, source), ...focused.reach];
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COLUMN_VIRTUAL.estimate[density],
    gap: COLUMN_VIRTUAL.gap,
    overscan: COLUMN_VIRTUAL.overscan,
    getItemKey: (index) => `${density}:${items[index]?.id ?? String(index)}`,
    rangeExtractor: (range) => withPinned(range, pinned),
  });
  const landingIndex = items.findIndex((application) => isLanding(application, source.landing));
  useLandingScroll(virtualizer, landingIndex);
  const rows = virtualizer.getVirtualItems();
  const lastShown = virtualizer.range?.endIndex ?? items.length - 1;
  return {
    rows,
    totalSize: virtualizer.getTotalSize(),
    below: items.length - 1 - lastShown,
    measureElement: virtualizer.measureElement,
    scrollRef,
    onFocus: focused.onFocus,
  };
}
