import { describe, expect, it } from 'vitest';

import { webUrlOf } from './web-url';

describe('webUrlOf', () => {
  it.each([
    {
      value: 'https://meet.google.com/abc-defg-hij',
      expected: 'https://meet.google.com/abc-defg-hij',
    },
    { value: 'http://zoom.us/j/123', expected: 'http://zoom.us/j/123' },
    { value: 'javascript:alert(1)', expected: null },
    { value: 'ftp://files.example/cv.pdf', expected: null },
    { value: 'meet.google.com/abc', expected: null },
    { value: 'Київ, вул. Хрещатик, 1', expected: null },
    { value: null, expected: null },
  ])('turns $value into the link $expected', ({ value, expected }) => {
    expect(webUrlOf(value)).toBe(expected);
  });
});
