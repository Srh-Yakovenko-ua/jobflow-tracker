import type { ColorToken, Tokens } from './schema.js';

type HexMap = Record<string, string>;

function hexes(colors: Record<string, ColorToken>): HexMap {
  return Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, color.hex]));
}

function overDark(light: HexMap, dark: Record<string, ColorToken>): HexMap {
  return Object.fromEntries(
    Object.entries(light).map(([name, hex]) => [name, dark[name]?.hex ?? hex]),
  );
}

function palettes(tokens: Tokens) {
  const light = {
    colors: hexes(tokens.color),
    outcome: hexes(tokens.outcome),
    stage: hexes(tokens.stage),
    data: Object.values(hexes(tokens.dataViz)),
  };
  const dark = {
    ...light,
    colors: overDark(light.colors, tokens.dark),
    outcome: overDark(light.outcome, tokens.dark),
  };
  return { light, dark };
}

function constModule(name: string, value: object): string {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
}

export function renderChartTheme(tokens: Tokens): string {
  const { duration, easing, stagger } = tokens.motion.data;
  return constModule('CHART_THEME', {
    ...palettes(tokens),
    font: { display: tokens.font.display.family, ui: tokens.font.ui.family },
    animation: { duration, easing, stagger },
  });
}

export function renderRnTheme(tokens: Tokens): string {
  const { flat, e1, e2, e3, accent } = tokens.elevation;
  return constModule('RN_THEME', {
    ...palettes(tokens),
    space: tokens.space,
    radius: tokens.radius,
    control: tokens.control,
    elevation: { flat: flat.rn, e1: e1.rn, e2: e2.rn, e3: e3.rn, accent: accent.rn },
  });
}
