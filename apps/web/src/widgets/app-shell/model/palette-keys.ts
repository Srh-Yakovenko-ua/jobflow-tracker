import { useSyncExternalStore } from 'react';

import { uk } from '@/shared/i18n';

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

export function usePaletteKeys(): readonly string[] {
  const apple = useSyncExternalStore(neverChanges, isAppleDevice, notOnServer);
  return [apple ? uk.ui.keys.meta : uk.ui.keys.ctrl, 'K'];
}
