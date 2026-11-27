import { mkdirSync, writeFileSync } from 'node:fs';

import {
  AI_PROMPT_VERSIONS,
  aiContractJsonSchemas,
  DOCUMENT_FAILURES,
  DOCUMENT_LIMITS,
  documentContractJsonSchemas,
  REJECTION_REASONS,
  SOURCE_LABELS,
  STAGE_LABELS,
  VACANCY_PARSE_LIMITS,
} from '../dist/index.js';

const contractsDir = new URL('../dist/contracts/', import.meta.url);
const schemasDir = new URL('schemas/', contractsDir);
const documentSchemasDir = new URL('documents/schemas/', contractsDir);

const writeJson = (url, value) => writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`);

const writeSchemas = (dir, schemas) => {
  mkdirSync(dir, { recursive: true });
  for (const [name, schema] of Object.entries(schemas)) {
    writeJson(new URL(`${name}.json`, dir), schema);
  }
};

writeSchemas(schemasDir, aiContractJsonSchemas());
writeSchemas(documentSchemasDir, documentContractJsonSchemas());

writeJson(new URL('prompt-versions.json', contractsDir), AI_PROMPT_VERSIONS);
writeJson(new URL('document-limits.json', contractsDir), {
  ...DOCUMENT_LIMITS,
  failures: DOCUMENT_FAILURES,
});
writeJson(new URL('vacancy-parse-limits.json', contractsDir), VACANCY_PARSE_LIMITS);

const labelsUk = (labels) =>
  Object.fromEntries(Object.entries(labels).map(([code, { labelUk }]) => [code, labelUk]));

writeJson(new URL('labels.json', contractsDir), {
  stages: labelsUk(STAGE_LABELS),
  sources: labelsUk(SOURCE_LABELS),
  reasons: labelsUk(REJECTION_REASONS),
});
