import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TABLE_BUILDERS } from '../src/tables.js';

const USAGE_HEADER = [
  'kind',
  'model',
  'calls',
  'tokens_in',
  'tokens_out',
  'avg_tokens_in',
  'avg_tokens_out',
  'avg_latency_ms',
  'cost_usd_per_call',
  'usd_per_million_tokens_in',
  'usd_per_million_tokens_out',
].join('\t');

const vacancyTsv = [
  'field\tcases\tcorrect\taccuracy\twrong_exact',
  'company\t10\t9\t0.900\t0',
  'position\t10\t10\t1.000\t0',
  '',
  'case\tfield\texpected\tgot\tconfidence',
  '03-dou-en-java-eur.json\tstack\tjava | spring\tjava\texact',
  '',
  'threshold\tminimum\tactual\tresult',
  'company\t0.9\t0.900\tPASS',
  'PASS',
  '',
  USAGE_HEADER,
  'vacancy\tnvidia/nemotron-super\t10\t41000\t5200\t4100\t520\t1830\t0.000000\t0\t0',
  '',
].join('\n');

const matchTsv = [
  'case\tmanual_rank\tscore\tscore_rank',
  'ranking.json#1\t1\t88\t1',
  '',
  'rho\t0.812',
  'rho_min\t0.6',
  'PASS',
  '',
  USAGE_HEADER,
  'match\tnvidia/nemotron-super\t5\t12000\t900\t2400\t180\t950\t0.000000\t0\t0',
].join('\n');

const tsvSource = (name, text) => ({ path: `docs/thesis/data/${name}`, text });

const jsonSource = (name, value) => ({
  path: `docs/thesis/data/${name}`,
  text: JSON.stringify(value),
});

describe('thesis tables', () => {
  it('turns every eval section except usage into a Ukrainian table with pipes escaped', () => {
    const lines = TABLE_BUILDERS.aiEval([tsvSource('ai-eval-vacancy.tsv', vacancyTsv)]);

    assert.deepEqual(lines, [
      '| Поле | Кейсів | Правильно | Точність | Хибних з exact |',
      '| --- | --- | --- | --- | --- |',
      '| company | 10 | 9 | 0.900 | 0 |',
      '| position | 10 | 10 | 1.000 | 0 |',
      '',
      '| Кейс | Поле | Очікувано | Отримано | Впевненість |',
      '| --- | --- | --- | --- | --- |',
      '| 03-dou-en-java-eur.json | stack | java \\| spring | java | exact |',
      '',
      '| Поріг | Мінімум | Факт | Результат |',
      '| --- | --- | --- | --- |',
      '| company | 0.9 | 0.900 | PASS |',
    ]);
  });

  it('shows a section of name and number pairs as an indicator table', () => {
    const lines = TABLE_BUILDERS.aiEval([tsvSource('ai-eval-match.tsv', matchTsv)]);

    assert.deepEqual(lines.slice(4), [
      '| Показник | Значення |',
      '| --- | --- |',
      '| rho | 0.812 |',
      '| rho_min | 0.6 |',
    ]);
  });

  it('collects the usage block of every eval into one cost table named by its model', () => {
    const lines = TABLE_BUILDERS.aiCost([
      tsvSource('ai-eval-vacancy.tsv', vacancyTsv),
      tsvSource('ai-eval-match.tsv', matchTsv),
    ]);

    assert.deepEqual(lines.slice(0, 2), ['Модель: nvidia/nemotron-super.', '']);
    assert.deepEqual(lines.slice(4), [
      '| vacancy | vacancy | nvidia/nemotron-super | 10 | 41000 | 5200 | 4100 | 520 | 1830 | 0.000000 | 0 | 0 |',
      '| match | match | nvidia/nemotron-super | 5 | 12000 | 900 | 2400 | 180 | 950 | 0.000000 | 0 | 0 |',
    ]);
  });

  it('translates every column of the usage block the api writes', () => {
    const [header = ''] = TABLE_BUILDERS.aiCost([tsvSource('ai-eval-match.tsv', matchTsv)]).slice(
      2,
    );
    const cells = header.split('|').slice(1, -1);

    assert.equal(cells.length, USAGE_HEADER.split('\t').length + 1);
    for (const name of USAGE_HEADER.split('\t')) {
      assert.ok(!cells.some((value) => value.trim() === name), `${name} has no Ukrainian header`);
    }
  });

  it('lists coverage per package with a dash for a missing metric and the test total', () => {
    const lines = TABLE_BUILDERS.coverage([
      jsonSource('coverage.json', {
        packages: [
          { package: '@jobflow/api', tests: 812, lines: 91.2, branches: 84.5, functions: 90 },
          { package: '@jobflow/ai', tests: 140, lines: 95.03, branches: null, functions: null },
        ],
      }),
    ]);

    assert.deepEqual(lines, [
      '| Пакет | Тестів | Рядки, % | Гілки, % | Функції, % |',
      '| --- | --- | --- | --- | --- |',
      '| @jobflow/api | 812 | 91.2 | 84.5 | 90 |',
      '| @jobflow/ai | 140 | 95.03 | - | - |',
      '| Разом | 952 | - | - | - |',
    ]);
  });

  it('lists the e2e tests and the audit by severity', () => {
    const e2e = TABLE_BUILDERS.e2e([
      jsonSource('e2e.json', { tests: [{ file: 'demo.test.ts', title: 'opens the demo board' }] }),
    ]);
    const audit = TABLE_BUILDERS.audit([
      jsonSource('audit.json', {
        vulnerabilities: { info: 0, low: 1, moderate: 2, high: 0, critical: 0 },
      }),
    ]);

    assert.deepEqual(e2e.slice(2), ['| demo.test.ts | opens the demo board |']);
    assert.deepEqual(audit.slice(2), [
      '| critical | 0 |',
      '| high | 0 |',
      '| moderate | 2 |',
      '| low | 1 |',
      '| info | 0 |',
    ]);
  });

  it('lists the CSP directives and the security headers of the security document', () => {
    const securityMd = [
      '## Content Security Policy and headers',
      '',
      '```text',
      "default-src 'self';",
      "frame-ancestors 'none'",
      '```',
      '',
      '| Header | Value | Why |',
      '| --- | --- | --- |',
      '| `X-Frame-Options`    | `DENY`  | No framing |',
      '',
      '| Item | Measure | Test |',
      '| --- | --- | --- |',
      '| A01 Broken access control | One guard | `idor.int.test.ts` |',
    ].join('\n');

    const lines = TABLE_BUILDERS.securityHeaders([{ path: 'docs/security.md', text: securityMd }]);

    assert.deepEqual(lines, [
      '| Заголовок або директива | Значення |',
      '| --- | --- |',
      "| Content-Security-Policy: default-src | 'self' |",
      "| Content-Security-Policy: frame-ancestors | 'none' |",
      '| X-Frame-Options | DENY |',
    ]);
  });
});
