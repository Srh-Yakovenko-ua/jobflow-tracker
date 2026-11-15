import { isUsage, tsvSections } from './tables.js';

const SNAPSHOT_RULES = {
  fakeModel: 'fake',
  stoppedLine: /^stopped\t.*$/m,
  junitTests: /<testsuite\b[^>]*\btests="(\d+)"/,
};

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10_000) / 100 : null);

function usageModels(text) {
  const [header = [], ...rows] = tsvSections(text).find(isUsage) ?? [];
  const modelColumn = header.indexOf('model');
  return modelColumn === -1 ? [] : rows.map((cells) => cells[modelColumn]);
}

export function evalProblem(text) {
  const stopped = text.match(SNAPSHOT_RULES.stoppedLine)?.[0];
  if (stopped !== undefined) {
    return `the run stopped: ${stopped.replaceAll('\t', ' ')}`;
  }
  const models = usageModels(text);
  if (models.length === 0) {
    return 'it has no usage block with a model';
  }
  return models.includes(SNAPSHOT_RULES.fakeModel)
    ? 'it was measured on the fake AI provider'
    : null;
}

export function vitestRow({ name, results, summary }) {
  const { lines, branches, functions } = summary.total;
  return {
    package: name,
    tests: results.numTotalTests,
    lines: lines.pct,
    branches: branches.pct,
    functions: functions.pct,
  };
}

export function pytestRow({ name, junit, coverage }) {
  const tests = junit.match(SNAPSHOT_RULES.junitTests)?.[1];
  if (tests === undefined) {
    throw new Error(`The pytest report of ${name} has no test count`);
  }
  const { totals } = coverage;
  return {
    package: name,
    tests: Number(tests),
    lines: percent(totals.covered_lines, totals.num_statements),
    branches: percent(totals.covered_branches ?? 0, totals.num_branches ?? 0),
    functions: null,
  };
}

function specLines(suite, titles) {
  return [
    ...(suite.specs ?? []).map((spec) => ({
      file: spec.file,
      title: [...titles, spec.title].join(' › '),
    })),
    ...(suite.suites ?? []).flatMap((child) => specLines(child, [...titles, child.title])),
  ];
}

export const e2eTests = (report) => (report.suites ?? []).flatMap((suite) => specLines(suite, []));

export function auditCounts(report) {
  const counts = report.metadata?.vulnerabilities;
  if (counts === undefined) {
    throw new Error('The pnpm audit report has no vulnerability counts');
  }
  return counts;
}

const TRIVY_SEVERITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'info',
};

const ZAP_RISKS = { 3: 'high', 2: 'medium', 1: 'low', 0: 'info' };

function tally(levels, start) {
  const counts = { findings: levels.length, ...start };
  for (const level of levels) {
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

export function trivyCounts(report) {
  if (report.SchemaVersion !== 2) {
    throw new Error('The report is not a Trivy JSON report (SchemaVersion 2)');
  }
  const findings = (report.Results ?? []).flatMap((result) => [
    ...(result.Vulnerabilities ?? []),
    ...(result.Misconfigurations ?? []),
    ...(result.Secrets ?? []),
  ]);
  const start = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  return tally(
    findings.map(({ Severity }) => TRIVY_SEVERITIES[Severity] ?? 'info'),
    start,
  );
}

export function zapCounts(report) {
  if (!Array.isArray(report.site)) {
    throw new Error('The report is not a ZAP JSON report (no site list)');
  }
  const alerts = report.site.flatMap((site) => site.alerts ?? []);
  const start = { critical: null, high: 0, medium: 0, low: 0, info: 0 };
  return tally(
    alerts.map(({ riskcode }) => ZAP_RISKS[riskcode] ?? 'info'),
    start,
  );
}

export function gitleaksCount(findings) {
  if (!Array.isArray(findings)) {
    throw new Error('The report is not a gitleaks JSON report (no finding list)');
  }
  return findings.length;
}
