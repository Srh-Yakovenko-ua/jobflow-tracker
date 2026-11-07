import { useTheme } from '@/shared/lib/theme';
import { useMediaQuery } from '@/shared/lib/use-media-query';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

export function useThemeFlip(): () => void {
  const { theme, setTheme } = useTheme();
  const prefersDark = useMediaQuery(DARK_SCHEME);
  const shownDark = theme === 'dark' || (theme === 'system' && prefersDark);
  return () => {
    setTheme(shownDark ? 'light' : 'dark');
  };
}
