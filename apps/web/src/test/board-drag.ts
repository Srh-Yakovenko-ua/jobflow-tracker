import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

export type BoardDrag = {
  over: (section: HTMLElement) => void;
  drop: () => void;
  cancel: () => void;
};

const COLUMN_BOX = { pitch: 300, width: 280, height: 600 } as const;

const VIRTUAL_BOX = { row: 110, scroller: 600 } as const;

const DROP_SECTION = 'section[data-drop]';

const ACTIVATION_STEP_PX = 10;

const DROP_CLICK_GUARD_MS = 50;

function columnBoxOf(element: Element): DOMRect {
  const section = element.closest(DROP_SECTION);
  const index =
    section === null ? -1 : [...document.querySelectorAll(DROP_SECTION)].indexOf(section);
  if (index < 0) {
    return new DOMRect();
  }
  return new DOMRect(index * COLUMN_BOX.pitch, 0, COLUMN_BOX.width, COLUMN_BOX.height);
}

function pointerAt(element: Element) {
  const box = element.getBoundingClientRect();
  return { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
}

function heightOf(element: HTMLElement): number {
  if (element.matches('[data-index]')) {
    return VIRTUAL_BOX.row;
  }
  return element.matches('[data-column-scroll]') ? VIRTUAL_BOX.scroller : 0;
}

export function layOutColumns() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function boxOf(
    this: Element,
  ) {
    return columnBoxOf(this);
  });
  for (const side of ['offsetHeight', 'clientHeight'] as const) {
    vi.spyOn(HTMLElement.prototype, side, 'get').mockImplementation(function sizeOf(
      this: HTMLElement,
    ) {
      return heightOf(this);
    });
  }
}

export function startDrag(card: HTMLElement): BoardDrag {
  const start = pointerAt(card);
  fireEvent.mouseDown(card, start);
  fireEvent.mouseMove(document, { ...start, clientX: start.clientX + ACTIVATION_STEP_PX });
  return {
    over: (section) => {
      fireEvent.mouseMove(document, pointerAt(section));
    },
    drop: () => {
      fireEvent.mouseUp(document);
    },
    cancel: () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    },
  };
}

export async function waitOutDropClickGuard() {
  await act(() => vi.advanceTimersByTimeAsync(DROP_CLICK_GUARD_MS));
  vi.useRealTimers();
}
