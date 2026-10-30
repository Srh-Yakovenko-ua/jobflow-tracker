import { type RefObject, useEffect } from 'react';

export const SEARCH_SHORTCUT = '/';

const TYPING_TARGETS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null;
}

function isShortcut(event: KeyboardEvent): boolean {
  return event.key === SEARCH_SHORTCUT && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function useSlashShortcut(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!isShortcut(event) || isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener('keydown', focusSearch);
    return () => {
      document.removeEventListener('keydown', focusSearch);
    };
  }, [input]);
}
