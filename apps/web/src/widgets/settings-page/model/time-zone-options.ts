import type { SelectOption } from '@/shared/ui/field-surface';

const optionOf = (timeZone: string): SelectOption => ({ value: timeZone, label: timeZone });

export function timeZoneOptions(stored: string): readonly SelectOption[] {
  const known = Intl.supportedValuesOf('timeZone');
  const zones = known.includes(stored) ? known : [stored, ...known];
  return zones.map(optionOf);
}
