import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..');

const HOVER_CLASS = /(?<=[\s'"`])(?:[a-z-]+:)*hover:(?!-?translate)/;

const SOURCE_FILES = readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' }).filter(
  (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
);

const lacksPressedPair = (line: string) => HOVER_CLASS.test(line) && !line.includes('active:');

const linesWithoutPressedPair = () =>
  SOURCE_FILES.flatMap((file) =>
    readFileSync(join(SOURCE_ROOT, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => (lacksPressedPair(line) ? [`${file}:${String(index + 1)}`] : [])),
  );

describe('pressed pair of every hover', () => {
  it('no class list in the web app has a hover without its pressed state', () => {
    expect(linesWithoutPressedPair()).toEqual([]);
  });

  it.each([
    { line: "'text-ink-3 hover:bg-surface-3 hover:text-ink'", lacks: true },
    { line: "ghost: 'text-link not-disabled:hover:bg-accent-tint'", lacks: true },
    { line: "'text-ink-3 hover:text-ink active:text-ink'", lacks: false },
    { line: "'not-disabled:hover:-translate-y-px'", lacks: false },
    { line: "'group-has-[li:hover]/funnel:not-hover:opacity-55'", lacks: false },
  ])('reads $line as lacking a pressed pair: $lacks', ({ line, lacks }) => {
    expect(lacksPressedPair(line)).toBe(lacks);
  });
});
