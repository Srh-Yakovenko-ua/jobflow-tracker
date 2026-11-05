import type { DropAnimationFunctionArguments, UniqueIdentifier } from '@dnd-kit/core';
import { CHART_THEME } from '@jobflow/shared/chart-theme';

import { prefersReducedMotion } from '@/shared/lib/reduced-motion';

export type DropLanding = 'to-source' | 'to-card' | 'in-place';

export type DropGlideOptions = Readonly<{ landing: DropLanding; onLanded: () => void }>;

type DropArguments = DropAnimationFunctionArguments;

type Glide = Readonly<{ animation: Animation; node: HTMLElement | null }>;

type CardNodes = ReadonlyMap<
  UniqueIdentifier,
  { node: { current: HTMLElement | null } } | undefined
>;

export type GlideStart = Readonly<{
  active: Pick<DropArguments['active'], 'id' | 'node'>;
  dragOverlay: DropArguments['dragOverlay'];
  draggableNodes: CardNodes;
  measuringConfiguration: {
    draggable: Pick<DropArguments['measuringConfiguration']['draggable'], 'measure'>;
  };
  transform: DropArguments['transform'];
}>;

export const DROP_GLIDE = {
  waitFrames: 30,
  timing: {
    duration: CHART_THEME.motion.base,
    easing: `cubic-bezier(${CHART_THEME.motion.easing.join(', ')})`,
    fill: 'forwards',
  },
} as const satisfies { waitFrames: number; timing: KeyframeAnimationOptions };

const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function registeredNode({ active, draggableNodes }: GlideStart): HTMLElement | null {
  return draggableNodes.get(active.id)?.node.current ?? null;
}

async function movedNode(start: GlideStart, framesLeft: number): Promise<HTMLElement> {
  const node = registeredNode(start);
  if (node !== null && node !== start.active.node) return node;
  if (framesLeft === 0) return node ?? start.active.node;
  await nextFrame();
  return movedNode(start, framesLeft - 1);
}

function cssOf({ x, y, scaleX, scaleY }: GlideStart['transform']): string {
  return `translate3d(${String(x)}px, ${String(y)}px, 0) scaleX(${String(scaleX)}) scaleY(${String(scaleY)})`;
}

function glideTo(start: GlideStart, target: HTMLElement): Keyframe[] {
  const { dragOverlay, transform, measuringConfiguration } = start;
  const rect = measuringConfiguration.draggable.measure(target);
  const landed = {
    ...transform,
    x: transform.x - (dragOverlay.rect.left - rect.left),
    y: transform.y - (dragOverlay.rect.top - rect.top),
  };
  return [{ transform: cssOf(transform) }, { transform: cssOf(landed) }];
}

async function keyframesOf(start: GlideStart, landing: DropLanding): Promise<Keyframe[]> {
  if (landing === 'in-place') return FADE_OUT;
  const target =
    landing === 'to-card' ? await movedNode(start, DROP_GLIDE.waitFrames) : start.active.node;
  return glideTo(start, target);
}

async function endWhenMovedAgain(start: GlideStart, glide: Glide): Promise<void> {
  await nextFrame();
  if (glide.animation.playState !== 'running') return;
  const node = registeredNode(start);
  if (node !== null && node !== glide.node) {
    glide.animation.finish();
    return;
  }
  return endWhenMovedAgain(start, glide);
}

export function createDropGlide({ landing, onLanded }: DropGlideOptions) {
  return async (start: GlideStart): Promise<void> => {
    try {
      const overlay = start.dragOverlay.node;
      if (prefersReducedMotion() || !('animate' in overlay)) return;
      const keyframes = await keyframesOf(start, landing);
      const animation = overlay.animate(keyframes, DROP_GLIDE.timing);
      void endWhenMovedAgain(start, { animation, node: registeredNode(start) });
      await animation.finished;
    } finally {
      onLanded();
    }
  };
}
