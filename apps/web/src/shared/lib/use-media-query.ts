import { useSyncExternalStore } from 'react';

export function matchesMediaQuery(query: string): boolean {
  return window.matchMedia(query).matches;
}

function changesOf(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => {
      list.removeEventListener('change', onChange);
    };
  };
}

function noMatchOnServer(): boolean {
  return false;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(changesOf(query), () => matchesMediaQuery(query), noMatchOnServer);
}
