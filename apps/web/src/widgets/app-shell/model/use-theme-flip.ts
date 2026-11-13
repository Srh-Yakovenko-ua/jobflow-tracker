import { useShownScheme, useTheme } from '@/shared/lib/theme';

export function useThemeFlip(): () => void {
  const { setTheme } = useTheme();
  const scheme = useShownScheme();
  return () => {
    setTheme(scheme === 'dark' ? 'light' : 'dark');
  };
}
