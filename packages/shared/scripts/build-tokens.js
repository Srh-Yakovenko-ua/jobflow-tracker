import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { renderThemeCss, renderTokensCss } from '../src/tokens/css.ts';
import { renderChartTheme, renderRnTheme } from '../src/tokens/native.ts';
import { parseTokens } from '../src/tokens/schema.ts';

const tokensDir = new URL('../tokens/', import.meta.url);
const generatedDir = new URL('generated/', tokensDir);

const tokens = parseTokens(JSON.parse(readFileSync(new URL('tokens.json', tokensDir), 'utf8')));

const outputs = {
  'tokens.css': renderTokensCss(tokens),
  'theme.css': renderThemeCss(tokens),
  'chart-theme.ts': renderChartTheme(tokens),
  'rn-theme.ts': renderRnTheme(tokens),
};

function readCurrent(file) {
  try {
    return readFileSync(new URL(file, generatedDir), 'utf8');
  } catch {
    return undefined;
  }
}

if (process.argv.includes('--check')) {
  const stale = Object.keys(outputs).filter((file) => readCurrent(file) !== outputs[file]);
  for (const file of stale) {
    process.stderr.write(
      `stale: packages/shared/tokens/generated/${file}, run pnpm tokens:build\n`,
    );
  }
  process.exitCode = stale.length > 0 ? 1 : 0;
} else {
  mkdirSync(generatedDir, { recursive: true });
  for (const [file, content] of Object.entries(outputs)) {
    writeFileSync(new URL(file, generatedDir), content);
  }
}
