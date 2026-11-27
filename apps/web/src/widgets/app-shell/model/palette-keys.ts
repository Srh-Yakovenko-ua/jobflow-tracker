import { uk } from '@/shared/i18n';
import { useAppleDevice } from '@/shared/lib/apple-device';

export function usePaletteKeys(): readonly string[] {
  return [useAppleDevice() ? uk.ui.keys.meta : uk.ui.keys.ctrl, 'K'];
}
