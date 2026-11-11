import { describe, expect, it } from 'vitest';

import { type BookmarkletConfig, bookmarkletHref } from './href.js';
import { javascriptUrlOf } from './javascript-url.js';
import { ADDED_BODY, CONFIG, stubFetch } from './test/api.js';
import { DOU_PAGE } from './test/fixtures/pages.js';
import { mountPage, shownToast, toastLinkHref } from './test/page.js';

declare const BOOKMARKLET_CODE: string;

const PLACEHOLDER = '__JOBFLOW_CONFIG__';
const CARD_URL = 'http://localhost:3000/applications/6f1c2b1e-5a0d-4c5e-9b7a-2f4d8e1a3c10';

function storedCodeOf(href: string): string {
  return decodeURIComponent(new URL(href).href.slice('javascript:'.length));
}

function runScript(code: string): void {
  const script: unknown = Reflect.construct(Function, [code]);
  if (typeof script !== 'function') {
    throw new Error('The bookmarklet code did not parse into a function');
  }
  Reflect.apply(script, undefined, []);
}

function runStored(config: BookmarkletConfig) {
  mountPage(DOU_PAGE);
  const fetchStub = stubFetch({ status: 202, body: ADDED_BODY });
  runScript(storedCodeOf(bookmarkletHref(config)));
  return fetchStub;
}

describe('javascriptUrlOf', () => {
  it('escapes percent signs, hashes, question marks and whitespace only', () => {
    expect(javascriptUrlOf('a%20b#c?d\te\nf g("я")')).toBe(
      'javascript:a%2520b%23c%3Fd%09e%0Af%20g("я")',
    );
  });

  it('survives the form a browser stores in a bookmark', () => {
    const code = 'x="%20";y=a?"#<b>":`\t\n`;z="я і ї"';

    expect(storedCodeOf(javascriptUrlOf(code))).toBe(code);
  });
});

describe('bookmarkletHref', () => {
  it('builds on a bundle that reads its config in one place', () => {
    expect(BOOKMARKLET_CODE.split(PLACEHOLDER)).toHaveLength(2);
  });

  it('stays under 8 KB as stored, with a capture token and the local addresses', () => {
    expect(CONFIG.token).toHaveLength(43);
    expect(new URL(bookmarkletHref(CONFIG)).href.length).toBeLessThan(8192);
  });

  it('decodes to the bundle with the config written in', () => {
    const code = storedCodeOf(bookmarkletHref(CONFIG));

    expect(code).toBe(
      BOOKMARKLET_CODE.replace(
        PLACEHOLDER,
        '{"token":"k7_k7_k7_k7_k7_k7_k7_k7_k7_k7_k7_k7_k7_k7_Q","apiUrl":"http://localhost:4000","webUrl":"http://localhost:3000"}',
      ),
    );
  });

  it('writes a token with replacement patterns and quotes in as a literal', () => {
    const token = '$&"$1\\';

    expect(storedCodeOf(bookmarkletHref({ ...CONFIG, token }))).toContain(
      `{"token":${JSON.stringify(token)},"apiUrl"`,
    );
  });

  it('stores the addresses without a trailing slash and posts to a path with one slash', async () => {
    const config = {
      ...CONFIG,
      apiUrl: 'http://localhost:4000/',
      webUrl: 'http://localhost:3000//',
    };
    const fetchStub = runStored(config);

    expect(storedCodeOf(bookmarkletHref(config))).toContain('"webUrl":"http://localhost:3000"}');
    await expect
      .poll(() => fetchStub.mock.calls[0]?.[0])
      .toBe('http://localhost:4000/api/v1/capture/bookmarklet');
    await expect.poll(toastLinkHref).toBe(CARD_URL);
  });

  it('runs in a page as the stored code and shows the added toast', async () => {
    const fetchStub = runStored(CONFIG);

    await expect.poll(() => shownToast().textContent).toContain('Додано в JobFlow · AI розбирає');
    expect(toastLinkHref()).toBe(CARD_URL);
    expect(fetchStub.mock.calls[0]?.[1].headers).toMatchObject({
      Authorization: `Capture ${CONFIG.token}`,
    });
  });
});
