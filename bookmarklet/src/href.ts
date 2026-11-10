import { javascriptUrlOf } from './javascript-url.js';

declare const BOOKMARKLET_CODE: string;

export type BookmarkletConfig = { token: string; apiUrl: string; webUrl: string };

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function bookmarkletHref({ token, apiUrl, webUrl }: BookmarkletConfig): string {
  const config = JSON.stringify({
    token,
    apiUrl: withoutTrailingSlash(apiUrl),
    webUrl: withoutTrailingSlash(webUrl),
  });
  return javascriptUrlOf(BOOKMARKLET_CODE.replace('__JOBFLOW_CONFIG__', () => config));
}
