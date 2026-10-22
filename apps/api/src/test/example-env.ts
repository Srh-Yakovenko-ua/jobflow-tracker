import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export const exampleEnv = parseEnv(
  readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8'),
);
