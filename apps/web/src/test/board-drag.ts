import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

export type BoardDrag = {
  over: (section: HTMLElement) => void;
  drop: () => void;
  cancel: () => void;
};

const COLUMN_BOX = { pitch: 300, width: 280, height: 600 } as const;

const DROP_SECTION = 'section[data-drop]';

const ACTIVATION_STEP_PX = 10;

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

export function layOutColumns() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function boxOf(
    this: Element,
  ) {
    return columnBoxOf(this);
  });
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
