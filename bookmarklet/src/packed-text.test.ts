import { describe, expect, it } from 'vitest';

import { packText, unpackText } from './packed-text.js';

describe('packText', () => {
  it('writes Cyrillic letters as single ASCII characters and marks the ASCII it displaces', () => {
    expect(packText('Додано в JobFlow · AI')).toBe('&PFBOP D ~Jo~b~Flow · ~A~I');
  });

  it.each([
    'Додано в JobFlow · AI розбирає',
    "техінтерв'ю, етап: 100% ~ґ…",
    'АБВ їієя "quoted" \\ `tick` ?#',
    '',
  ])('unpacks back to %j', (text) => {
    expect(unpackText(packText(text))).toBe(text);
  });
});
