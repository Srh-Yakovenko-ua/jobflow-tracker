import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { generateVAPIDKeys } from 'web-push';

const envFile = process.argv[2] ?? new URL('../../../.env', import.meta.url);
const KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];

if (!existsSync(envFile)) {
  process.stderr.write('No .env found: run cp .env.example .env first.\n');
  process.exit(1);
}

const lines = readFileSync(envFile, 'utf8').split('\n');
const valueOf = (key) => lines.find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1);

const present = KEYS.filter((key) => valueOf(key));

if (present.length === KEYS.length) {
  process.stdout.write('VAPID keys already set, nothing to do.\n');
  process.exit(0);
}

if (present.length > 0) {
  process.stderr.write(`Only ${present[0]} is set: empty both VAPID keys and run again.\n`);
  process.exit(1);
}

const { publicKey, privateKey } = generateVAPIDKeys();
const generated = { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey };
const filled = lines.map((line) => {
  const key = KEYS.find((name) => line === `${name}=`);
  return key === undefined ? line : `${key}=${generated[key]}`;
});
const missing = KEYS.filter((key) => valueOf(key) === undefined).map(
  (key) => `${key}=${generated[key]}`,
);
const trailing = filled.at(-1) === '' ? filled.slice(0, -1) : filled;

writeFileSync(envFile, [...trailing, ...missing, ''].join('\n'));
process.stdout.write('VAPID keys written to .env.\n');
