import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { DOCS_PATHS } from './paths.js';
import { TABLE_BUILDERS } from './tables.js';

const FIGURE_TYPES = new Set(['diagram', 'screenshot', 'table']);

const MANIFEST_RULES = {
  id: /^[a-z0-9-]+$/,
  ukrainian: /[а-яґєії]/iu,
  backticked: /`([^`\s]+)`/g,
  lineSuffix: /(:\d+)+$/,
  repoDirs: new Set(['apps', 'packages', 'services', 'docs', 'infra', 'bookmarklet', '.github']),
  composeService: /^ {2}([\w-]+):\s*$/,
};

export const sourcesOf = (entry) => [entry.source].flat();

const readText = (root, relative) => readFileSync(path.join(root, relative), 'utf8');

const listDir = (root, relative) =>
  existsSync(path.join(root, relative)) ? readdirSync(path.join(root, relative)).sort() : [];

function shapeProblems(entry) {
  const problems = [];
  if (!MANIFEST_RULES.id.test(String(entry.id))) {
    problems.push(`bad id "${String(entry.id)}"`);
  }
  if (!FIGURE_TYPES.has(entry.type)) {
    problems.push(`unknown type "${String(entry.type)}"`);
  }
  if (typeof entry.caption !== 'string' || !MANIFEST_RULES.ukrainian.test(entry.caption)) {
    problems.push('caption is empty or not Ukrainian');
  }
  if (entry.type === 'table' && !Object.hasOwn(TABLE_BUILDERS, String(entry.builder))) {
    problems.push(`unknown table builder "${String(entry.builder)}"`);
  }
  return problems;
}

function entryProblems(root, entry) {
  const sources = sourcesOf(entry);
  const missing = sources.filter(
    (source) => typeof source !== 'string' || !existsSync(path.join(root, source)),
  );
  const problems = [
    ...shapeProblems(entry),
    ...(sources.length === 0 ? ['no source'] : []),
    ...missing.map((source) => `source ${String(source)} does not exist`),
  ];
  return problems.map((problem) => `${DOCS_PATHS.manifest} ${String(entry.id)}: ${problem}`);
}

function duplicateProblems(entries) {
  const ids = entries.map((entry) => entry.id);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  return [...new Set(repeated)].map((id) => `${DOCS_PATHS.manifest}: id ${String(id)} repeats`);
}

function listingProblems(root, entries) {
  const listed = new Set(entries.flatMap(sourcesOf));
  const expected = [
    ...listDir(root, DOCS_PATHS.diagrams)
      .filter((file) => file.endsWith('.mmd'))
      .map((file) => `${DOCS_PATHS.diagrams}/${file}`),
    ...listDir(root, DOCS_PATHS.screenshots)
      .filter((file) => file.endsWith('.png'))
      .map((file) => `${DOCS_PATHS.screenshots}/${file}`),
  ];
  return expected
    .filter((file) => !listed.has(file))
    .map((file) => `${file} is not listed in ${DOCS_PATHS.manifest}`);
}

export function composeServices(composeText) {
  const lines = composeText.split('\n');
  const after = lines.slice(lines.indexOf('services:') + 1);
  const end = after.findIndex((line) => /^\S/.test(line));
  return after
    .slice(0, end === -1 ? after.length : end)
    .flatMap((line) => line.match(MANIFEST_RULES.composeService)?.slice(1) ?? []);
}

function deploymentProblems(root) {
  if (!existsSync(path.join(root, DOCS_PATHS.deployment))) {
    return [`${DOCS_PATHS.deployment} does not exist`];
  }
  const deployment = readText(root, DOCS_PATHS.deployment);
  const shown = (service) => new RegExp(`(^|[^\\w-])${service}([^\\w-]|$)`, 'm').test(deployment);
  return composeServices(readText(root, DOCS_PATHS.compose))
    .filter((service) => !shown(service))
    .map((service) => `compose service ${service} is missing from ${DOCS_PATHS.deployment}`);
}

const isRepoPath = (token) => MANIFEST_RULES.repoDirs.has(token.split('/')[0] ?? '');

function thesisPathProblems(root) {
  const chapters = listDir(root, DOCS_PATHS.thesis).filter((file) => file.endsWith('.md'));
  return chapters.flatMap((chapter) => {
    const text = readText(root, `${DOCS_PATHS.thesis}/${chapter}`);
    const tokens = [...text.matchAll(MANIFEST_RULES.backticked)].map((match) =>
      String(match[1]).replace(MANIFEST_RULES.lineSuffix, ''),
    );
    return tokens
      .filter((token) => isRepoPath(token) && !token.startsWith(DOCS_PATHS.build))
      .filter((token) => !existsSync(path.join(root, token)))
      .map((token) => `${DOCS_PATHS.thesis}/${chapter} names ${token}, which does not exist`);
  });
}

export function readManifest(root) {
  const manifest = JSON.parse(readText(root, DOCS_PATHS.manifest));
  if (!Array.isArray(manifest.figures)) {
    throw new Error(`${DOCS_PATHS.manifest} has no "figures" list`);
  }
  return manifest.figures;
}

export function manifestProblems(root) {
  const entries = readManifest(root);
  return [
    ...entries.flatMap((entry) => entryProblems(root, entry)),
    ...duplicateProblems(entries),
    ...listingProblems(root, entries),
    ...deploymentProblems(root),
    ...thesisPathProblems(root),
  ];
}

export function loadManifest(root) {
  const problems = manifestProblems(root);
  if (problems.length > 0) {
    throw new Error(`The figure manifest is invalid:\n${problems.join('\n')}`);
  }
  return readManifest(root);
}
