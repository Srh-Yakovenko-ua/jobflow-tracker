import { withoutQuery } from '../common/logger.js';

const READABLE_SEGMENT = /^(?:[a-z][a-z_-]{0,23}|v\d{1,2})$/;

const ID_SEGMENT = ':id';

export const redactedPath = (path: string): string =>
  withoutQuery(path)
    .split('/')
    .map((segment) => (segment === '' || READABLE_SEGMENT.test(segment) ? segment : ID_SEGMENT))
    .join('/');

export function redactedClientUrl(url: string): string {
  const parsed = URL.parse(url);
  return parsed === null ? redactedPath(url) : parsed.origin + redactedPath(parsed.pathname);
}
