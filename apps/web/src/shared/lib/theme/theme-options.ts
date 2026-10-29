import { THEMES } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export const THEME_OPTIONS = THEMES.map((theme) => ({ value: theme, label: uk.theme[theme] }));
