import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { devUk } from './dev-uk';
import { uk } from './uk';

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

const MAX_COPY_LENGTH = 120;
const SHOWCASE_KEYS = new Set(['devUi', 'designSystem']);

const longLeaves = (node: unknown, path: string): string[] => {
  if (typeof node === 'string') return node.length > MAX_COPY_LENGTH ? [path] : [];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([key, child]) => longLeaves(child, `${path}.${key}`));
};

const longCopyIn = (copy: object) =>
  Object.entries(copy)
    .filter(([key]) => !SHOWCASE_KEYS.has(key))
    .flatMap(([key, child]) => longLeaves(child, key));

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

  it('no uk string outside the showcase copy runs over 120 characters', () => {
    expect(longCopyIn({ ...uk, ...devUk })).toEqual([]);
  });

  it.each([
    { name: 'a 121-character leaf', copy: { a: { b: 'х'.repeat(121) } }, long: ['a.b'] },
    { name: 'a 120-character leaf', copy: { a: { b: 'х'.repeat(120) } }, long: [] },
    { name: 'a devUi leaf', copy: { devUi: { b: 'х'.repeat(121) } }, long: [] },
    { name: 'a designSystem leaf', copy: { designSystem: { b: 'х'.repeat(121) } }, long: [] },
    { name: 'an array item', copy: { a: ['ок', 'х'.repeat(121)] }, long: ['a.1'] },
    { name: 'a template', copy: { a: () => 'х'.repeat(121) }, long: [] },
  ])('lists $name as $long', ({ copy, long }) => {
    expect(longCopyIn(copy)).toEqual(long);
  });
});
