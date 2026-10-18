import { describe, expect, it } from 'vitest';

import { CHART_THEME } from '../../tokens/generated/chart-theme.js';
import source from '../../tokens/tokens.json';
import { THRESHOLDS } from '../thresholds.js';
import { renderThemeCss, renderTokensCss } from './css.js';
import { renderChartTheme, renderRnTheme } from './native.js';
import { type ColorToken, parseTokens, type Tokens } from './schema.js';

const tokens = parseTokens(source);

function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

function withColor(name: string, value: ColorToken): Tokens {
  return parseTokens({ ...tokens, color: { ...tokens.color, [name]: value } });
}

describe('tokens.json', () => {
  it('gives every color key a dark value and has no dark key outside color or outcome', () => {
    const lightKeys = [...Object.keys(tokens.color), ...Object.keys(tokens.outcome)];

    expect(Object.keys(tokens.dark).filter((key) => !lightKeys.includes(key))).toEqual([]);
    expect(Object.keys(tokens.color).filter((key) => !(key in tokens.dark))).toEqual([]);
  });

  it('keeps dataRules equal to the shared thresholds', () => {
    expect(tokens.dataRules).toEqual({
      minSampleForPercent: THRESHOLDS.MIN_N_PERCENT,
      minSampleForInsight: THRESHOLDS.MIN_N_INSIGHT,
      minSampleForForecast: THRESHOLDS.MIN_N_FORECAST,
    });
    expect(Object.values(tokens.dataRules)).toEqual([5, 10, 15]);
  });

  it('keeps every space token at 4px per step', () => {
    const offScale = Object.entries(tokens.space).filter(([key, px]) => px !== 4 * Number(key));

    expect(offScale).toEqual([]);
    expect(tokens.space['14']).toBe(56);
  });

  it('skips $-prefixed notes and refuses a short hex or a non-oklch web value', () => {
    expect(Object.keys(tokens.dataViz)).toEqual([
      'data-1',
      'data-2',
      'data-3',
      'data-4',
      'data-5',
      'data-6',
    ]);
    expect(() => withColor('accent', { oklch: 'oklch(52% 0.12 252)', hex: '#2D6' })).toThrow();
    expect(() => withColor('accent', { oklch: '#2D6BAB', hex: '#2D6BAB' })).toThrow();
    expect(() => parseTokens({ ...tokens, color: 'paper' })).toThrow();
  });
});

describe('web theme', () => {
  it('renders a changed accent at --accent and binds bg-accent to the variable', () => {
    const changed = withColor('accent', { oklch: 'oklch(60% 0.2 30)', hex: '#D0563B' });

    expect(blockAfter(renderTokensCss(changed), ':root')).toContain('--accent: oklch(60% 0.2 30);');
    expect(renderThemeCss(changed)).toContain('--color-accent: var(--accent);');
  });

  it('drops e1 to e3 shadows in dark but keeps flat and focus', () => {
    const dark = blockAfter(renderTokensCss(tokens), "[data-theme='dark']");

    expect(dark).toContain('color-scheme: dark;');
    expect(dark).toContain('--paper: oklch(22% 0.010 62);');
    expect(dark).toContain('--elevation-e1: 0 0 #0000;');
    expect(dark).toContain('--elevation-e3: 0 0 #0000;');
    expect(dark).not.toContain('--elevation-flat');
    expect(dark).not.toContain('--elevation-focus');
    expect(blockAfter(renderTokensCss(tokens), ':root')).toContain(
      '--elevation-focus: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);',
    );
  });

  it('follows the system dark theme unless the user picked light', () => {
    const css = renderTokensCss(tokens);

    expect(css).toContain(
      "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {",
    );
    expect(blockAfter(css, ":root:not([data-theme='light'])")).toContain(
      '--elevation-e2: 0 0 #0000;',
    );
  });

  it('zeroes every duration under reduced motion', () => {
    const reduced = renderTokensCss(tokens).split('@media (prefers-reduced-motion: reduce)')[1];

    expect(reduced).toContain('--duration-instant: 0ms;');
    expect(reduced).toContain('--duration-data: 0ms;');
    expect(reduced?.match(/--duration-[a-z]+: 0ms;/g)).toHaveLength(5);
  });

  it('maps the scale, type, shadows and easing to Tailwind namespaces', () => {
    const theme = renderThemeCss(tokens);

    expect(theme.startsWith('@theme inline {\n')).toBe(true);
    expect(theme).toContain('--spacing: 4px;');
    expect(theme).toContain('--spacing-control-lg: 42px;');
    expect(theme).toContain('--radius-pill: 999px;');
    expect(theme).toContain('--shadow-e2: var(--elevation-e2);');
    expect(theme).toContain("--font-display: 'Unbounded', sans-serif;");
    expect(theme).toContain('--font-mono: ui-monospace, monospace;');
    expect(theme).toContain('--text-body-l: 14.5px;');
    expect(theme).toContain('--text-num--line-height: 1;');
    expect(theme).toContain('--text-eyebrow--letter-spacing: 0.14em;');
    expect(theme).not.toContain('--text-body--letter-spacing');
    expect(theme).toContain('--color-stage-tech: var(--stage-tech);');
    expect(theme).toContain('--color-data-6: var(--data-6);');
    expect(theme).toContain('--ease-spring: var(--easing-spring);');
  });

  it('binds every colour utility to a variable tokens.css declares', () => {
    const root = blockAfter(renderTokensCss(tokens), ':root');
    const bound = [...renderThemeCss(tokens).matchAll(/--color-[\w-]+: var\((--[\w-]+)\);/g)];
    const undeclared = bound.filter(([, name]) => !root.includes(`  ${String(name)}: `));

    expect(bound).toHaveLength(27);
    expect(undeclared).toEqual([]);
  });
});

describe('native themes', () => {
  it('animates chart series for 820 ms with easeOutQuart and a 45 ms stagger', () => {
    expect(CHART_THEME.animation).toEqual({ duration: 820, easing: 'easeOutQuart', stagger: 45 });
    expect(CHART_THEME.dark.colors.accent).toBe('#6AA9EE');
    expect(CHART_THEME.dark.stage.tech).toBe('#499B9B');
  });

  it('falls back to the light hex where dark has no value', () => {
    const darkWithoutAccent = Object.fromEntries(
      Object.entries(tokens.dark).filter(([name]) => name !== 'accent'),
    );
    const rendered = renderChartTheme({ ...tokens, dark: darkWithoutAccent });

    expect(rendered).toContain('export const CHART_THEME = {');
    expect(rendered.split('"dark"')[1]).toContain('"accent": "#2D6BAB"');
  });

  it('gives the mobile app hex palettes, controls and elevation objects', () => {
    const rendered = renderRnTheme(tokens);

    expect(rendered).toContain('export const RN_THEME = {');
    expect(rendered).toContain('"padX": 20');
    expect(rendered).toContain('"elevation": 12');
    expect(rendered).not.toContain('"focus"');
    expect(rendered).not.toContain('"use"');
  });
});
