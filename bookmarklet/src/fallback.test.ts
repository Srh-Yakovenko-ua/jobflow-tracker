import { describe, expect, it, vi } from 'vitest';

import { addUrlOf, openFallback } from './fallback.js';
import { CONFIG } from './test/api.js';

const PAGE_URL = 'https://jobs.dou.ua/companies/acme/vacancies/271828/?from=list#apply';
const TITLE = 'Senior React Developer в Acme Software | DOU';
const HREF_MAX_LENGTH = 12_000;

function addUrlFor(payload: { url: string; text: string }): URL {
  return new URL(addUrlOf({ webUrl: CONFIG.webUrl, payload: { ...payload, title: TITLE } }));
}

describe('addUrlOf', () => {
  it('carries the page url and the title above the text to the add page', () => {
    const addUrl = addUrlFor({
      url: PAGE_URL,
      text: 'Шукаємо React розробника.\nTypeScript & Next.js',
    });

    expect(addUrl.origin + addUrl.pathname).toBe('http://localhost:3000/add');
    expect([...addUrl.searchParams.keys()]).toEqual(['url', 'text']);
    expect(addUrl.searchParams.get('url')).toBe(PAGE_URL);
    expect(addUrl.searchParams.get('text')).toBe(
      'Senior React Developer в Acme Software | DOU\n\nШукаємо React розробника.\nTypeScript & Next.js',
    );
  });

  it('cuts a long Cyrillic text until the whole address fits', () => {
    const url = `https://example.com/${'a'.repeat(2028)}`;
    const addUrl = addUrlFor({ url, text: 'я'.repeat(20_000) });
    const text = addUrl.searchParams.get('text') ?? '';

    expect(url).toHaveLength(2048);
    expect(addUrl.href.length).toBeLessThanOrEqual(HREF_MAX_LENGTH);
    expect(addUrl.searchParams.get('url')).toBe(url);
    expect(text.startsWith(`${TITLE}\n\nяяя`)).toBe(true);
    expect(text.length).toBeGreaterThan(1500);
    expect(addUrl.href).not.toContain(CONFIG.token);
  });

  it('keeps a text that fits whole', () => {
    const text = 'a'.repeat(9000);

    expect(addUrlFor({ url: PAGE_URL, text }).searchParams.get('text')).toBe(`${TITLE}\n\n${text}`);
  });
});

describe('openFallback', () => {
  it.each([
    { name: 'a new tab opened', opened: window, expected: true },
    { name: 'the browser blocked the tab', opened: null, expected: false },
  ])('reports whether $name', ({ opened, expected }) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(opened);

    expect(openFallback('http://localhost:3000/add?url=u&text=t')).toBe(expected);
    expect(open).toHaveBeenCalledWith('http://localhost:3000/add?url=u&text=t');
  });
});
