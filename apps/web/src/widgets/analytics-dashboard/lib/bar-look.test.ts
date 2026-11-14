import { CHART_THEME } from '@jobflow/shared/chart-theme';
import type { ChartEvent } from 'chart.js';
import { describe, expect, it } from 'vitest';

import { barLookOf } from './bar-look';

const HREFS = [undefined, '/board?stage=screening'];

function cursorOver(index: number): string {
  const target = document.createElement('canvas');
  const event: ChartEvent = { type: 'mousemove', native: new MouseEvent('mousemove'), x: 0, y: 0 };
  Object.defineProperty(event.native, 'target', { value: target });
  const look = barLookOf({
    palette: CHART_THEME.light,
    press: { hrefAt: (at) => HREFS[at], onBar: () => undefined },
  });
  look.onHover(event, [{ index }]);
  return target.style.cursor;
}

describe('barLookOf', () => {
  it('shows the pointer only over a bar that opens a link', () => {
    expect(cursorOver(1)).toBe('pointer');
    expect(cursorOver(0)).toBe('');
  });
});
