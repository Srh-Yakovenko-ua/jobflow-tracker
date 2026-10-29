import { type Theme, themeSchema } from '@jobflow/shared';

export const THEME_COOKIE = 'jobflow_theme';

export function themeFromCookie(value: string | undefined): Theme {
  return themeSchema.catch('system').parse(value);
}

export function writeThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
