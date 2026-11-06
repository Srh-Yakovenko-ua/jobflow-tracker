import { type RefObject, useEffect } from 'react';

import { isTypingTarget } from '@/shared/lib/typing-target';

export const SEARCH_SHORTCUT = '/';

function isShortcut(event: KeyboardEvent): boolean {
  return event.key === SEARCH_SHORTCUT && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function useSlashShortcut(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!isShortcut(event) || isTypingTarget(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener('keydown', focusSearch);
    return () => {
      document.removeEventListener('keydown', focusSearch);
    };
  }, [input]);
}
