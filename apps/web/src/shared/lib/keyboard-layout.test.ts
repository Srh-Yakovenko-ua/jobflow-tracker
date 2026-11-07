import { describe, expect, it } from 'vitest';

import { swapLayout } from './keyboard-layout';

describe('swapLayout', () => {
  it.each([
    { typed: 'кщ', meant: 'ro' },
    { typed: 'ro', meant: 'кщ' },
    { typed: 'RO', meant: 'кщ' },
    { typed: 'Ещ ro', meant: 'to кщ' },
    { typed: 'фкеуь', meant: 'artem' },
    { typed: "[]ж'бю", meant: 'хї;є,.' },
    { typed: 'q1 w2', meant: 'й1 ц2' },
    { typed: 'ґ-42', meant: 'ґ-42' },
  ])('reads «$typed» typed on the other layout as «$meant»', ({ typed, meant }) => {
    expect(swapLayout(typed)).toBe(meant);
  });
});
