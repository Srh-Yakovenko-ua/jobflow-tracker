import type { ColorToken, Tokens } from './schema.js';

type Declaration = readonly [string, string];

const SPACING_STEP_PX = 4;

const SHADOWLESS_IN_DARK = ['e1', 'e2', 'e3'] as const;

const NO_SHADOW = '0 0 #0000';

const MOTION_STEPS = ['instant', 'fast', 'base', 'spring', 'data'] as const;

function px(value: number): string {
  return `${String(value)}px`;
}

function cssBlock(selector: string, declarations: readonly Declaration[]): string {
  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n');
  return `${selector} {\n${body}\n}\n`;
}

function nestedBlock(atRule: string, inner: string): string {
  const indented = inner
    .trimEnd()
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return `${atRule} {\n${indented}\n}\n`;
}

type NamedColor = readonly [string, ColorToken];

function colorVars(colors: readonly NamedColor[]): Declaration[] {
  return colors.map(([name, color]): Declaration => [`--${name}`, color.oklch]);
}

function webColors(tokens: Tokens): NamedColor[] {
  return [
    ...Object.entries(tokens.color),
    ...Object.entries(tokens.outcome),
    ...Object.entries(tokens.stage).map(([name, color]): NamedColor => [`stage-${name}`, color]),
    ...Object.entries(tokens.dataViz),
  ];
}

function durationVars(tokens: Tokens): Declaration[] {
  return MOTION_STEPS.map((step): Declaration => [
    `--duration-${step}`,
    `${String(tokens.motion[step].duration)}ms`,
  ]);
}

function lightDeclarations(tokens: Tokens): Declaration[] {
  return [
    ['color-scheme', 'light'],
    ...colorVars(webColors(tokens)),
    ...Object.entries(tokens.elevation).map(([name, elevation]): Declaration => [
      `--elevation-${name}`,
      elevation.web,
    ]),
    ...durationVars(tokens),
    ['--easing', tokens.motion.easing],
    ['--easing-spring', tokens.motion.spring.easing],
  ];
}

function darkDeclarations(tokens: Tokens): Declaration[] {
  return [
    ['color-scheme', 'dark'],
    ...colorVars(Object.entries(tokens.dark)),
    ...SHADOWLESS_IN_DARK.map((name): Declaration => [`--elevation-${name}`, NO_SHADOW]),
  ];
}

export function renderTokensCss(tokens: Tokens): string {
  const dark = darkDeclarations(tokens);
  const reducedMotion = durationVars(tokens).map(([name]): Declaration => [name, '0ms']);
  return [
    cssBlock(':root', lightDeclarations(tokens)),
    cssBlock("[data-theme='dark']", dark),
    nestedBlock(
      '@media (prefers-color-scheme: dark)',
      cssBlock(":root:not([data-theme='light'])", dark),
    ),
    nestedBlock('@media (prefers-reduced-motion: reduce)', cssBlock(':root', reducedMotion)),
  ].join('\n');
}

function themeColorVars(tokens: Tokens): Declaration[] {
  return webColors(tokens).map(([name]): Declaration => [`--color-${name}`, `var(--${name})`]);
}

function sizeVars(tokens: Tokens): Declaration[] {
  return [
    ['--spacing', px(SPACING_STEP_PX)],
    ...Object.entries(tokens.control).map(([size, control]): Declaration => [
      `--spacing-control-${size}`,
      px(control.height),
    ]),
    ...Object.entries(tokens.radius).map(([name, radius]): Declaration => [
      `--radius-${name}`,
      px(radius),
    ]),
    ...Object.keys(tokens.elevation).map((name): Declaration => [
      `--shadow-${name}`,
      `var(--elevation-${name})`,
    ]),
  ];
}

function fontStack(family: string, fallback: string): string {
  const name = family.startsWith('ui-') ? family : `'${family}'`;
  return `${name}, ${fallback}`;
}

function fontVars(tokens: Tokens): Declaration[] {
  return [
    ['--font-display', fontStack(tokens.font.display.family, 'sans-serif')],
    ['--font-ui', fontStack(tokens.font.ui.family, 'sans-serif')],
    ['--font-mono', fontStack(tokens.font.mono.family, 'monospace')],
  ];
}

function typeVars(tokens: Tokens): Declaration[] {
  return Object.entries(tokens.type).flatMap(([name, type]) => {
    const prefix = `--text-${name}`;
    const declarations: Declaration[] = [
      [prefix, px(type.size)],
      [`${prefix}--line-height`, String(type.lineHeight)],
      [`${prefix}--font-weight`, String(type.weight)],
    ];
    if (type.tracking === undefined) {
      return declarations;
    }
    return [...declarations, [`${prefix}--letter-spacing`, type.tracking]];
  });
}

export function renderThemeCss(tokens: Tokens): string {
  return cssBlock('@theme inline', [
    ...themeColorVars(tokens),
    ...sizeVars(tokens),
    ...fontVars(tokens),
    ...typeVars(tokens),
    ['--ease-standard', 'var(--easing)'],
    ['--ease-spring', 'var(--easing-spring)'],
  ]);
}
