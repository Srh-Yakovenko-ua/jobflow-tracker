import { describe, expect, it } from 'vitest';

import { mailtoOf, telegramHandleOf, telegramUrlOf } from './contact-links';

describe('telegram links', () => {
  it.each([
    { raw: '@oksana_hr', handle: '@oksana_hr', url: 'https://t.me/oksana_hr' },
    { raw: 'oksana_hr', handle: '@oksana_hr', url: 'https://t.me/oksana_hr' },
    {
      raw: 'javascript:alert(1)',
      handle: '@javascript:alert(1)',
      url: 'https://t.me/javascript%3Aalert(1)',
    },
    {
      raw: 'a/../../evil?x=1',
      handle: '@a/../../evil?x=1',
      url: 'https://t.me/a%2F..%2F..%2Fevil%3Fx%3D1',
    },
  ])('the stored value $raw reads as $handle and opens $url', ({ raw, handle, url }) => {
    expect(telegramHandleOf(raw)).toBe(handle);
    expect(telegramUrlOf(raw)).toBe(url);
  });
});

describe('mailtoOf', () => {
  it('writes the parsed email after a fixed mailto scheme', () => {
    expect(mailtoOf('o.levchenko@acme.io')).toBe('mailto:o.levchenko@acme.io');
  });
});
