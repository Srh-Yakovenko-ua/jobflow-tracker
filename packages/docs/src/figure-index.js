import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { figureOutput } from './diagrams.js';
import { sourcesOf } from './manifest.js';
import { DOCS_PATHS } from './paths.js';
import { markdownTable, tableOutput } from './tables.js';

const FIGURE_LABELS = { diagram: 'Рисунок', screenshot: 'Рисунок', table: 'Таблиця' };

const OUTPUTS = {
  diagram: (entry) => `${figureOutput(entry, 'svg')}, ${figureOutput(entry, 'png')}`,
  screenshot: (entry) => String(entry.source),
  table: tableOutput,
};

export function writeFigureIndex(root, entries) {
  const counters = new Map();
  const rows = entries.map((entry) => {
    const label = FIGURE_LABELS[entry.type];
    counters.set(label, (counters.get(label) ?? 0) + 1);
    return [
      `${label} ${String(counters.get(label))}`,
      entry.caption,
      sourcesOf(entry).join(', '),
      OUTPUTS[entry.type](entry),
    ];
  });
  const lines = [
    '# Перелік рисунків і таблиць',
    '',
    ...markdownTable([['number', 'caption', 'source', 'output'], ...rows]),
  ];
  writeFileSync(path.join(root, DOCS_PATHS.build, 'figures.md'), `${lines.join('\n')}\n`);
}
