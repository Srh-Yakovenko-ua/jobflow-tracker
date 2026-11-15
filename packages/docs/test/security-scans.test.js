import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { inRepo } from '../src/paths.js';
import { SCANNER_IMAGES } from '../src/security-scans.js';

const readRepo = (relative) => readFileSync(inRepo(relative), 'utf8');

describe('security scanner pins', () => {
  it('uses the same digest-pinned images as the security workflow', () => {
    const workflow = readRepo('.github/workflows/security.yml');

    for (const image of Object.values(SCANNER_IMAGES)) {
      assert.match(image, /^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
      assert.ok(workflow.includes(image), `${image} is not the image security.yml runs`);
    }
  });

  it('runs the same gitleaks image in the pre-commit hook', () => {
    assert.ok(readRepo('.husky/pre-commit').includes(SCANNER_IMAGES.gitleaks));
  });
});
