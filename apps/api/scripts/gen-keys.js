import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const secretsDir = new URL('../../../.secrets/', import.meta.url);
const privateKeyFile = new URL('jwt-private.pem', secretsDir);
const publicKeyFile = new URL('jwt-public.pem', secretsDir);

if (existsSync(privateKeyFile) && existsSync(publicKeyFile)) {
  process.stdout.write('JWT keys already exist in .secrets/, nothing to do.\n');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
writeFileSync(privateKeyFile, privateKey, { mode: 0o600 });
writeFileSync(publicKeyFile, publicKey, { mode: 0o644 });
process.stdout.write('JWT keys written to .secrets/jwt-private.pem and .secrets/jwt-public.pem.\n');
