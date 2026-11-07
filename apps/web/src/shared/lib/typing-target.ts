const TYPING_TARGETS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null;
}
