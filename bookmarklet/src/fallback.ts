import type { CaptureBookmarkletInput } from '@jobflow/shared';

export type FallbackInput = { webUrl: string; payload: CaptureBookmarkletInput };

const HREF_MAX_LENGTH = 12_000;

function hrefWith({ webUrl, payload }: FallbackInput, text: string): string {
  const addUrl = new URL('/add', webUrl);
  addUrl.searchParams.set('url', payload.url);
  addUrl.searchParams.set('text', text);
  return addUrl.href;
}

export function addUrlOf(input: FallbackInput): string {
  let text = `${input.payload.title}\n\n${input.payload.text}`;
  let href = hrefWith(input, text);
  while (href.length > HREF_MAX_LENGTH && text) {
    text = text.slice(0, Math.floor((text.length * HREF_MAX_LENGTH) / href.length));
    href = hrefWith(input, text);
  }
  return href;
}

export function openFallback(href: string): boolean {
  return window.open(href) !== null;
}
