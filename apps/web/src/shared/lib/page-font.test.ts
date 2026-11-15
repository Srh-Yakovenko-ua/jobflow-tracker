import { afterEach, describe, expect, it } from 'vitest';

import { loadPageFonts } from './page-font';

const ONEST = "600 18px 'onest', 'onest Fallback'";

const UNBOUNDED = "700 64px 'unbounded', 'unbounded Fallback'";

function fakeFontSet(steps: string[]) {
  const fonts = {
    load: (font: string) => {
      steps.push(`load ${font}`);
      return font.includes('Fallback')
        ? Promise.reject(new DOMException('A network error occurred.', 'NetworkError'))
        : Promise.resolve([]);
    },
    get ready() {
      steps.push('ready');
      return Promise.resolve(fonts);
    },
  };
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts');
});

describe('loadPageFonts', () => {
  it('resolves when the system lacks the local face a fallback family points at', async () => {
    fakeFontSet([]);

    await expect(loadPageFonts([ONEST, UNBOUNDED])).resolves.toBeUndefined();
  });

  it('starts every font load before it waits for the font set to settle', async () => {
    const steps: string[] = [];
    fakeFontSet(steps);

    await loadPageFonts([ONEST, UNBOUNDED]);

    expect(steps).toEqual([`load ${ONEST}`, `load ${UNBOUNDED}`, 'ready']);
  });
});
