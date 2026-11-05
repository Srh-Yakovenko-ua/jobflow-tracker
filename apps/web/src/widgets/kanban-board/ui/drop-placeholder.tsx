import { useDndContext } from '@dnd-kit/core';

import { uk } from '@/shared/i18n';
import { Reveal } from '@/shared/ui/reveal';

export type DropPlaceholderProps = Readonly<{ shown: boolean }>;

function Slot() {
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

export function DropPlaceholder({ shown }: DropPlaceholderProps) {
  return (
    <Reveal shown={shown} mode="popLayout" className="-mb-2.5 flex-none">
      <div className="pb-2.5">
        <Slot />
      </div>
    </Reveal>
  );
}
