import type { UniqueIdentifier, UseDndContextReturnValue } from '@dnd-kit/core';

export type BoardNodes = Pick<UseDndContextReturnValue, 'draggableNodes' | 'droppableContainers'>;

export function focusCardOrStrip(
  nodes: BoardNodes,
  id: UniqueIdentifier,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const card = nodes.draggableNodes.get(id)?.node.current;
      const strip = nodes.droppableContainers.get(id)?.node.current?.querySelector('button');
      const target = card ?? strip ?? null;
      target?.focus();
      resolve(target);
    }, 0);
  });
}
