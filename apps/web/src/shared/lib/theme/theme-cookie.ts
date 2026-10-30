import { type Theme, themeSchema } from '@jobflow/shared';

import { writeCookie } from '../cookie';

export const THEME_COOKIE = 'jobflow_theme';

export function themeFromCookie(value: string | undefined): Theme {
  return themeSchema.catch('system').parse(value);
}

export function writeThemeCookie(theme: Theme): void {
  writeCookie({ name: THEME_COOKIE, value: theme });
}
