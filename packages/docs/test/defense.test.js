import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { inRepo, REPO_ROOT } from '../src/paths.js';

const DEFENSE = { file: 'docs/defense.md', budgetMinutes: 10, minQuestions: 10 };

const SECTIONS = { timing: 'Таймінг', questions: 'Питання комісії' };

const text = readFileSync(inRepo(DEFENSE.file), 'utf8');

const sectionOf = (heading) => {
  const [, body = ''] = text.split(`\n## ${heading}\n`);
  return body.split('\n## ')[0] ?? '';
};

const tableMinutes = (section) =>
  section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').at(-2)?.trim().replace(',', '.') ?? '')
    .filter((cell) => /^\d+(\.\d+)?$/.test(cell))
    .map(Number);

const relativeLinks = () =>
  [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(([, target]) => target.split('#')[0] ?? '')
    .filter((target) => target !== '' && !/^[a-z]+:/.test(target));

const trackedFiles = () =>
  new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\0'),
  );

describe('the defense script', () => {
  it('lists at least ten committee questions', () => {
    const questions = sectionOf(SECTIONS.questions).match(/^### /gm) ?? [];
    assert.ok(questions.length >= DEFENSE.minQuestions, `${String(questions.length)} questions`);
  });

  it('fits the talk into ten minutes', () => {
    const minutes = tableMinutes(sectionOf(SECTIONS.timing));
    assert.ok(minutes.length > 0, 'the timing table has no minutes');
    const total = minutes.reduce((sum, value) => sum + value, 0);
    assert.ok(total <= DEFENSE.budgetMinutes, `the talk takes ${String(total)} minutes`);
  });

  it('links only files that git tracks', () => {
    const tracked = trackedFiles();
    const docsFolder = path.posix.dirname(DEFENSE.file);
    const missing = relativeLinks()
      .map((target) => path.posix.normalize(path.posix.join(docsFolder, decodeURI(target))))
      .filter((target) => !tracked.has(target));
    assert.deepEqual(missing, []);
  });
});
