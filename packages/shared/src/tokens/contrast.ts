import type { Theme } from '../themes.js';
import type { ColorToken, Tokens } from './schema.js';

type PaletteTheme = Exclude<Theme, 'system'>;

type Palette = Record<string, ColorToken>;

type Tint = Readonly<{ color: string; percent: number }>;

export type TextPair = {
  text: string;
  background: string;
  themes: readonly PaletteTheme[];
  tint?: Tint;
};

export type ContrastRow = {
  theme: PaletteTheme;
  text: string;
  background: string;
  ratio: number;
  minimum: number;
  result: 'PASS' | 'FAIL';
};

const TEXT_MINIMUM = 4.5;

const BOTH_THEMES: readonly PaletteTheme[] = ['light', 'dark'];

const DANGER_TINTS = [6, 10] as const;

function pairsOf(texts: string[], backgrounds: string[]): TextPair[] {
  return backgrounds.flatMap((background) =>
    texts.map((text) => ({ text, background, themes: BOTH_THEMES })),
  );
}

function dangerTintsOver(background: string, themes: readonly PaletteTheme[]): TextPair[] {
  return DANGER_TINTS.map((percent) => ({
    text: 'danger',
    background,
    themes,
    tint: { color: 'danger', percent },
  }));
}

export const TEXT_PAIRS: readonly TextPair[] = [
  ...pairsOf(
    ['ink', 'ink-2', 'ink-3', 'accent', 'link', 'danger'],
    ['paper', 'surface', 'surface-2', 'surface-3'],
  ),
  ...pairsOf(['ink', 'ink-2', 'accent-ink', 'link'], ['accent-tint']),
  ...pairsOf(['surface'], ['accent']),
  ...pairsOf(['paper'], ['ink']),
  { text: 'surface', background: 'accent-press', themes: ['light'] },
  { text: 'paper', background: 'accent-press', themes: ['dark'] },
  ...dangerTintsOver('surface', BOTH_THEMES),
  ...dangerTintsOver('surface-2', ['light']),
];

function channelsOf(hex: string | undefined): number[] {
  return (hex?.match(/[\dA-F]{2}/gi) ?? []).map((pair) => Number.parseInt(pair, 16));
}

export function luminanceOf(hex: string | undefined): number {
  const channels = channelsOf(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string | undefined, second: string | undefined): number {
  const [darker, lighter] = [luminanceOf(first), luminanceOf(second)].sort(
    (left, right) => left - right,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function hexOf(palette: Palette, name: string): string {
  const hex = palette[name]?.hex;
  if (hex === undefined) {
    throw new Error(`tokens.json has no colour ${name}`);
  }
  return hex;
}

function backgroundHexOf(palette: Palette, { background, tint }: TextPair): string {
  const base = hexOf(palette, background);
  if (tint === undefined) return base;
  const share = tint.percent / 100;
  const over = channelsOf(hexOf(palette, tint.color));
  const blended = channelsOf(base).map((channel, index) =>
    Math.round((over[index] ?? 0) * share + channel * (1 - share)),
  );
  return `#${blended.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function backgroundNameOf({ background, tint }: TextPair): string {
  return tint === undefined
    ? background
    : `${tint.color}/${String(tint.percent)} over ${background}`;
}

function rowsOf(theme: PaletteTheme, palette: Palette): ContrastRow[] {
  return TEXT_PAIRS.filter((pair) => pair.themes.includes(theme)).map((pair) => {
    const ratio = contrastRatio(hexOf(palette, pair.text), backgroundHexOf(palette, pair));
    const result = ratio >= TEXT_MINIMUM ? 'PASS' : 'FAIL';
    const background = backgroundNameOf(pair);
    return { theme, text: pair.text, background, ratio, minimum: TEXT_MINIMUM, result };
  });
}

export function contrastRows(tokens: Tokens): ContrastRow[] {
  return [...rowsOf('light', tokens.color), ...rowsOf('dark', { ...tokens.color, ...tokens.dark })];
}
