import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const COPY_RULES = {
  spacedDash: /\s\u2014|\u2014\s/,
  russianStem: /[кК]арточ|[зЗ]аметк|[зЗ]аметц/,
} as const;

const FOLDER = import.meta.dirname;

const COPY_FILES = readdirSync(FOLDER).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
);

const rulesBrokenBy = (line: string) =>
  Object.entries(COPY_RULES).flatMap(([name, pattern]) => (pattern.test(line) ? [name] : []));

const linesBreaking = (pattern: RegExp) =>
  COPY_FILES.flatMap((file) =>
    readFileSync(join(FOLDER, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${file}:${String(index + 1)}`] : [])),
  );

describe('Ukrainian UI copy', () => {
  it.each(Object.entries(COPY_RULES))('no i18n line breaks the %s rule', (_name, pattern) => {
    expect(linesBreaking(pattern)).toEqual([]);
  });

  it.each([
    { line: "'Один клік \u2014 і картка переїде.'", broken: ['spacedDash'] },
    { line: "headline: ['Пошук роботи \u2014', 'є воронкою,'],", broken: ['spacedDash'] },
    { line: "one: 'карточка в роботі',", broken: ['russianStem'] },
    { line: "'текст у заметці'", broken: ['russianStem'] },
    { line: "  empty: '\u2014',", broken: [] },
    { line: "strong: '80\u2013100 · сильний',", broken: [] },
    { line: `range: \`\${min}\u2013\${max}\`,`, broken: [] },
    { line: "one: 'картка в роботі',", broken: [] },
    { line: "title: 'Нотатка до відмови',", broken: [] },
  ])('reads $line as breaking $broken', ({ line, broken }) => {
    expect(rulesBrokenBy(line)).toEqual(broken);
  });
});
