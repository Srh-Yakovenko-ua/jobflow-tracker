import { type RefObject, useEffect } from 'react';

import { isTypingTarget } from '@/shared/lib/typing-target';

export const SEARCH_SHORTCUT = '/';

export type SlashShortcutInput = Readonly<{
  input: RefObject<HTMLInputElement | null>;
  enabled: boolean;
}>;

function isShortcut(event: KeyboardEvent): boolean {
  return event.key === SEARCH_SHORTCUT && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function useSlashShortcut({ input, enabled }: SlashShortcutInput) {
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (!enabled || !isShortcut(event) || isTypingTarget(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener('keydown', focusSearch);
    return () => {
      document.removeEventListener('keydown', focusSearch);
    };
  }, [input, enabled]);
}
