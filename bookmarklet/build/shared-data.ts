import {
  CAPTURE_BOOKMARKLET_LIMITS,
  IDEMPOTENCY_CONFLICT_TYPE,
  STAGE_LABELS,
  STAGES,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';
import { CHART_THEME } from '@jobflow/shared/chart-theme';

import tokens from '../../packages/shared/tokens/tokens.json' with { type: 'json' };
import { COPY_UK, type CopyKey } from '../src/copy-uk.js';
import { packText } from '../src/packed-text.js';
import type { SharedData } from '../src/shared-data.js';

const TOAST_COLOURS = {
  s: 'surface',
  i: 'ink',
  m: 'ink-2',
  k: 'link',
  a: 'accent',
  t: 'accent-tint',
  l: 'line-soft',
} as const;

type ThemeColours = Record<(typeof TOAST_COLOURS)[keyof typeof TOAST_COLOURS], string>;

function cssVariablesOf(colours: ThemeColours): string {
  return Object.entries(TOAST_COLOURS)
    .map(([variable, token]) => `--${variable}:${colours[token]}`)
    .join(';');
}

function compactCss(value: string): string {
  return value.replaceAll(' / ', '/').replaceAll(', ', ',');
}

function packedTextsOf<Key extends string>(keys: readonly Key[], textOf: (key: Key) => string) {
  return Object.fromEntries(keys.map((key) => [key, packText(textOf(key))])) as Record<Key, string>;
}

const { motion } = CHART_THEME;

const shared = {
  copy: packedTextsOf(Object.keys(COPY_UK) as CopyKey[], (key) => COPY_UK[key]),
  stageLabels: packedTextsOf(STAGES, (stage) => STAGE_LABELS[stage].labelUk),
  textMaxLength: VACANCY_PARSE_LIMITS.textMaxLength,
  titleMaxLength: CAPTURE_BOOKMARKLET_LIMITS.titleMaxLength,
  look: {
    light: cssVariablesOf(CHART_THEME.light.colors),
    dark: cssVariablesOf(CHART_THEME.dark.colors),
    font: CHART_THEME.font.ui,
    radius: `${String(tokens.radius['2xl'])}px`,
    shadow: compactCss(tokens.elevation.e3.web),
    spring: `${String(motion.spring)}ms cubic-bezier(${motion.springEasing.join()})`,
    hover: `${String(motion.instant)}ms`,
  },
} satisfies SharedData;

export const SHARED_DEFINE = {
  BOOKMARKLET_SHARED: JSON.stringify(shared),
  BOOKMARKLET_IDEMPOTENCY_CONFLICT: JSON.stringify(IDEMPOTENCY_CONFLICT_TYPE),
};
