import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { contrastRows } from '../src/tokens/contrast.ts';
import { parseTokens } from '../src/tokens/schema.ts';

const dataDir = new URL('../../../docs/thesis/data/', import.meta.url);

const tokens = parseTokens(
  JSON.parse(readFileSync(new URL('../tokens/tokens.json', import.meta.url), 'utf8')),
);

const rows = contrastRows(tokens);

const lines = rows.map((row) =>
  [row.theme, row.text, row.background, row.ratio.toFixed(2), row.minimum, row.result].join('\t'),
);

mkdirSync(dataDir, { recursive: true });
writeFileSync(
  new URL('contrast.tsv', dataDir),
  ['theme\ttext\tbackground\tratio\tminimum\tresult', ...lines, ''].join('\n'),
);

const failing = rows.filter((row) => row.result === 'FAIL');
for (const row of failing) {
  process.stderr.write(
    `contrast ${row.ratio.toFixed(2)} below ${row.minimum}: ${row.theme} ${row.text} on ${row.background}\n`,
  );
}
process.exitCode = failing.length > 0 ? 1 : 0;
