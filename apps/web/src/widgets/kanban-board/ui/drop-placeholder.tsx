import { useDndContext } from '@dnd-kit/core';

import { uk } from '@/shared/i18n';

export function DropPlaceholder() {
  const { activeNodeRect } = useDndContext();
  return (
    <div
      aria-hidden
      style={{ height: activeNodeRect?.height }}
      className="flex min-h-19 flex-none items-center justify-center rounded-xl border-[1.5px] border-dashed border-accent bg-accent-tint text-[11px] font-semibold tracking-[0.1em] text-accent-ink uppercase motion-safe:animate-pop-in"
    >
      {uk.board.move.dropHere}
    </div>
  );
}
