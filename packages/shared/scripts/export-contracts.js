import { mkdirSync, writeFileSync } from 'node:fs';

import {
  AI_PROMPT_VERSIONS,
  aiContractJsonSchemas,
  DOCUMENT_LIMITS,
  documentContractJsonSchemas,
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
writeJson(new URL('document-limits.json', contractsDir), DOCUMENT_LIMITS);
