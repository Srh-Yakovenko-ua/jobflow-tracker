import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export const TABLE_VIRTUAL = { rowPx: 46, overscan: 10 } as const;

export type TableVirtualizerOptions = Readonly<{ ids: readonly string[] }>;

export function useTableVirtualizer({ ids }: TableVirtualizerOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TABLE_VIRTUAL.rowPx,
    overscan: TABLE_VIRTUAL.overscan,
    getItemKey: (index) => ids[index] ?? String(index),
  });
  const items = virtualizer.getVirtualItems();
  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  return { scrollRef, items, before, after };
}
