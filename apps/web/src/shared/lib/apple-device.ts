import { useSyncExternalStore } from 'react';

const APPLE_DEVICE = /Mac|iPhone|iPad/;

function neverChanges(): () => void {
  return () => undefined;
}

function isAppleDevice(): boolean {
  return APPLE_DEVICE.test(navigator.userAgent);
}

function notOnServer(): boolean {
  return false;
}

export function useAppleDevice(): boolean {
  return useSyncExternalStore(neverChanges, isAppleDevice, notOnServer);
}
