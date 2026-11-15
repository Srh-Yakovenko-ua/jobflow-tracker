import { CHART_THEME } from '@jobflow/shared/chart-theme';

export type PageFontInput = Readonly<{ variable: string; fallback: string }>;

export const PAGE_FONTS = {
  display: { variable: '--font-unbounded', fallback: CHART_THEME.font.display },
  ui: { variable: '--font-onest', fallback: CHART_THEME.font.ui },
} as const satisfies Record<string, PageFontInput>;

export function pageFont({ variable, fallback }: PageFontInput): string {
  if (typeof document === 'undefined') return fallback;
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return family || fallback;
}

export async function loadPageFonts(fonts: readonly string[]): Promise<void> {
  await Promise.allSettled(fonts.map((font) => document.fonts.load(font)));
  await document.fonts.ready;
}
