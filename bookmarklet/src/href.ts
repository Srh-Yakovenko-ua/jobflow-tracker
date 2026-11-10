import { javascriptUrlOf } from './javascript-url.js';

declare const BOOKMARKLET_CODE: string;

export type BookmarkletConfig = { token: string; apiUrl: string; webUrl: string };

export function bookmarkletHref({ token, apiUrl, webUrl }: BookmarkletConfig): string {
  const config = JSON.stringify({ token, apiUrl, webUrl });
  return javascriptUrlOf(BOOKMARKLET_CODE.replace('__JOBFLOW_CONFIG__', () => config));
}
