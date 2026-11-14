import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ukrainianHeader } from './headers.js';
import { DOCS_PATHS } from './paths.js';

const TABLE_RULES = {
  missing: '-',
  numberLike: /^(-?\d|NaN$)/,
  evalFile: /^ai-eval-(.+)\.tsv$/,
  severities: ['critical', 'high', 'moderate', 'low', 'info'],
  coverageColumns: ['package', 'tests', 'lines', 'branches', 'functions'],
  cspBlock: /## Content Security Policy[\s\S]*?```text\n([\s\S]*?)\n```/,
  headerRow: /^\| `[A-Z][\w-]+` +\| /,
};

const cell = (value) => (value === null || value === undefined ? TABLE_RULES.missing : value);

const row = (cells) =>
  `| ${cells.map((value) => String(cell(value)).replaceAll('|', '\\|')).join(' | ')} |`;

export function markdownTable([header = [], ...rows]) {
  return [row(header.map(ukrainianHeader)), row(header.map(() => '---')), ...rows.map(row)];
}

const isKeyValue = (rows) =>
  rows.every((cells) => cells.length === 2) && TABLE_RULES.numberLike.test(rows[0]?.[1] ?? '');

export const isUsage = (rows) => rows[0]?.includes('tokens_in') ?? false;

export function tsvSections(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.includes('\t'))
        .map((line) => line.split('\t')),
    )
    .filter((rows) => rows.length > 0);
}

const asTable = (rows) => markdownTable(isKeyValue(rows) ? [['key', 'value'], ...rows] : rows);

const joinTables = (tables) =>
  tables.flatMap((lines, index) => (index === 0 ? lines : ['', ...lines]));

function aiEval(sources) {
  const sections = sources.flatMap(({ text }) => tsvSections(text));
  return joinTables(sections.filter((rows) => !isUsage(rows)).map(asTable));
}

function usageRows({ path: sourcePath, text }) {
  const evalName = path.basename(sourcePath).match(TABLE_RULES.evalFile)?.[1] ?? sourcePath;
  const [header = [], ...rows] = tsvSections(text).find(isUsage) ?? [];
  return { header: ['eval', ...header], rows: rows.map((cells) => [evalName, ...cells]) };
}

function aiCost(sources) {
  const usages = sources.map(usageRows);
  const header = usages[0]?.header ?? [];
  const rows = usages.flatMap((usage) => usage.rows);
  const modelColumn = header.indexOf('model');
  const models = [...new Set(rows.map((cells) => cells[modelColumn]))];
  return [`Модель: ${models.join(', ')}.`, '', ...markdownTable([header, ...rows])];
}

const parsed = (sources) => JSON.parse(sources[0]?.text ?? '{}');

function coverage(sources) {
  const { packages = [] } = parsed(sources);
  const tests = packages.reduce((sum, entry) => sum + entry.tests, 0);
  const rows = packages.map((entry) => TABLE_RULES.coverageColumns.map((name) => entry[name]));
  return markdownTable([TABLE_RULES.coverageColumns, ...rows, ['Разом', tests, null, null, null]]);
}

function e2e(sources) {
  const { tests = [] } = parsed(sources);
  return markdownTable([['file', 'title'], ...tests.map(({ file, title }) => [file, title])]);
}

function audit(sources) {
  const { vulnerabilities = {} } = parsed(sources);
  const rows = TABLE_RULES.severities.map((severity) => [severity, vulnerabilities[severity] ?? 0]);
  return markdownTable([['severity', 'count'], ...rows]);
}

function cspDirectives(text) {
  const policy = text.match(TABLE_RULES.cspBlock)?.[1] ?? '';
  return policy
    .split('\n')
    .map((line) => line.trim().replace(/;$/, ''))
    .filter((line) => line !== '')
    .map((line) => {
      const [directive = '', ...values] = line.split(' ');
      return [`Content-Security-Policy: ${directive}`, values.join(' ')];
    });
}

const headerRows = (text) =>
  text
    .split('\n')
    .filter((line) => TABLE_RULES.headerRow.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, 3)
        .map((part) => part.trim().replaceAll('`', '')),
    );

function securityHeaders(sources) {
  const text = sources[0]?.text ?? '';
  return markdownTable([['header', 'value'], ...cspDirectives(text), ...headerRows(text)]);
}

export const TABLE_BUILDERS = { aiEval, aiCost, coverage, e2e, audit, securityHeaders };

export const tableOutput = (entry) => `${DOCS_PATHS.build}/tables/${entry.id}.md`;

function stampLine(root, sourcePaths) {
  const stampsPath = path.join(root, DOCS_PATHS.stamps);
  const stamps = existsSync(stampsPath) ? JSON.parse(readFileSync(stampsPath, 'utf8')) : {};
  const days = [...new Set(sourcePaths.flatMap((source) => stamps[source]?.slice(0, 10) ?? []))];
  return days.length > 0 ? [`Виміряно: ${days.join(', ')}.`, ''] : [];
}

export function writeTables(root, entries) {
  mkdirSync(path.join(root, DOCS_PATHS.build, 'tables'), { recursive: true });
  for (const entry of entries.filter(({ type }) => type === 'table')) {
    const sourcePaths = [entry.source].flat();
    const sources = sourcePaths.map((source) => ({
      path: source,
      text: readFileSync(path.join(root, source), 'utf8'),
    }));
    const body = TABLE_BUILDERS[entry.builder](sources);
    const lines = [`**${entry.caption}**`, '', ...stampLine(root, sourcePaths), ...body];
    writeFileSync(path.join(root, tableOutput(entry)), `${lines.join('\n')}\n`);
  }
}
