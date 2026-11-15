import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  auditCounts,
  e2eTests,
  evalProblem,
  gitleaksCount,
  pytestRow,
  sarifCounts,
  vitestRow,
  zapCounts,
} from '../src/snapshots.js';

const FIXTURES = { trivySarif: new URL('fixtures/trivy-fs.sarif', import.meta.url) };

const evalTsv = (model) =>
  [
    'field\tcases\tcorrect',
    'company\t10\t9',
    '',
    'model\tcalls\ttokens_in',
    `${model}\t10\t400`,
  ].join('\n');

describe('docs:data snapshots', () => {
  it('accepts an eval measured on a real model', () => {
    assert.equal(evalProblem(evalTsv('nvidia/nemotron-super')), null);
  });

  it('refuses an eval measured on the fake provider, a stopped run and a missing usage block', () => {
    assert.equal(evalProblem(evalTsv('fake')), 'it was measured on the fake AI provider');
    assert.equal(
      evalProblem('stopped\t01-a.json\tnot_ready\nFAIL\n'),
      'the run stopped: stopped 01-a.json not_ready',
    );
    assert.equal(evalProblem('field\tcases\ncompany\t10\n'), 'it has no usage block with a model');
  });

  it('reads tests and coverage of a vitest package', () => {
    const row = vitestRow({
      name: '@jobflow/shared',
      results: { numTotalTests: 214 },
      summary: {
        total: { lines: { pct: 97.5 }, branches: { pct: 91.25 }, functions: { pct: 100 } },
      },
    });

    assert.deepEqual(row, {
      package: '@jobflow/shared',
      tests: 214,
      lines: 97.5,
      branches: 91.25,
      functions: 100,
    });
  });

  it('reads tests and coverage of a pytest package without function coverage', () => {
    const row = pytestRow({
      name: '@jobflow/analytics',
      junit:
        '<?xml version="1.0"?><testsuites><testsuite name="pytest" errors="0" tests="131" time="2.1">',
      coverage: {
        totals: { covered_lines: 950, num_statements: 1000, covered_branches: 0, num_branches: 0 },
      },
    });

    assert.deepEqual(row, {
      package: '@jobflow/analytics',
      tests: 131,
      lines: 95,
      branches: null,
      functions: null,
    });
  });

  it('lists every e2e spec with its describe titles', () => {
    const tests = e2eTests({
      suites: [
        {
          title: 'demo.test.ts',
          file: 'demo.test.ts',
          specs: [{ title: 'opens the demo board', file: 'demo.test.ts' }],
          suites: [
            {
              title: 'kanban',
              file: 'demo.test.ts',
              specs: [{ title: 'moves a card by keyboard', file: 'demo.test.ts' }],
            },
          ],
        },
      ],
    });

    assert.deepEqual(tests, [
      { file: 'demo.test.ts', title: 'opens the demo board' },
      { file: 'demo.test.ts', title: 'kanban › moves a card by keyboard' },
    ]);
  });

  it('reads the vulnerability counts of a pnpm audit and refuses another shape', () => {
    const vulnerabilities = { info: 0, low: 1, moderate: 0, high: 0, critical: 0 };

    assert.deepEqual(auditCounts({ metadata: { vulnerabilities } }), vulnerabilities);
    assert.throws(() => auditCounts({ error: 'offline' }), /no vulnerability counts/);
  });

  it('counts the Trivy SARIF results by the severity tag of their rule and refuses another shape', () => {
    const counts = sarifCounts(JSON.parse(readFileSync(FIXTURES.trivySarif, 'utf8')));

    assert.deepEqual(counts, { findings: 5, critical: 1, high: 1, medium: 1, low: 1, info: 1 });
    assert.deepEqual(sarifCounts({ runs: [{ tool: { driver: { name: 'Trivy' } } }] }), {
      findings: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    });
    assert.throws(() => sarifCounts({ SchemaVersion: 2 }), /not a SARIF report/);
  });

  it('counts the ZAP alerts of every site by risk and refuses another shape', () => {
    const counts = zapCounts({
      site: [
        { alerts: [{ riskcode: '2' }, { riskcode: '1' }, { riskcode: '0' }] },
        { alerts: [{ riskcode: '3' }, { riskcode: '1' }] },
      ],
    });

    assert.deepEqual(counts, { findings: 5, critical: null, high: 1, medium: 1, low: 2, info: 1 });
    assert.throws(() => zapCounts({ alerts: [] }), /not a ZAP JSON report/);
  });

  it('counts the gitleaks findings and refuses another shape', () => {
    assert.equal(gitleaksCount([{ RuleID: 'github-pat' }, { RuleID: 'generic-api-key' }]), 2);
    assert.equal(gitleaksCount([]), 0);
    assert.throws(() => gitleaksCount({ findings: [] }), /not a gitleaks JSON report/);
  });
});
