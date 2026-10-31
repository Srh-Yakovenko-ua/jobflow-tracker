import { describe, expect, it } from 'vitest';

import { timeZoneOptions } from './time-zone-options';

const valuesOf = (stored: string) => timeZoneOptions(stored).map((option) => option.value);

describe('timeZoneOptions', () => {
  it('lists every zone the browser knows, the stored one once', () => {
    const values = valuesOf('America/New_York');

    expect(values).toContain('Asia/Tokyo');
    expect(values.filter((value) => value === 'America/New_York')).toEqual(['America/New_York']);
    expect(values.length).toBe(Intl.supportedValuesOf('timeZone').length);
  });

  it('puts a stored zone the browser does not list first, so it stays selectable', () => {
    expect(valuesOf('US/Pacific').slice(0, 2)).toEqual(['US/Pacific', expect.any(String)]);
    expect(valuesOf('US/Pacific').length).toBe(Intl.supportedValuesOf('timeZone').length + 1);
  });
});
