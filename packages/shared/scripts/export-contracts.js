import { mkdirSync, writeFileSync } from 'node:fs';

import { AI_PROMPT_VERSIONS, aiContractJsonSchemas } from '../dist/index.js';

const contractsDir = new URL('../dist/contracts/', import.meta.url);
const schemasDir = new URL('schemas/', contractsDir);

const writeJson = (url, value) => writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`);

mkdirSync(schemasDir, { recursive: true });

for (const [name, schema] of Object.entries(aiContractJsonSchemas())) {
  writeJson(new URL(`${name}.json`, schemasDir), schema);
}

writeJson(new URL('prompt-versions.json', contractsDir), AI_PROMPT_VERSIONS);
