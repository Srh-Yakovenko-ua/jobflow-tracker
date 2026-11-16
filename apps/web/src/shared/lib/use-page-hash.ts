import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

function hashOf(): string {
  return window.location.hash;
}

function noHashOnServer(): string {
  return '';
}

export function usePageHash(): string {
  return useSyncExternalStore(subscribe, hashOf, noHashOnServer);
}
