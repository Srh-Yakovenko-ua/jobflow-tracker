import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { mermaidSource } from '../src/diagrams.js';
import { inRepo } from '../src/paths.js';

describe('mermaid source of a figure', () => {
  it('takes the mermaid block out of a markdown file and drops the fences', () => {
    const markdown =
      '# ERD\n\n```mermaid\nerDiagram\n  users {\n    uuid id\n  }\n```\n\nText after.\n';

    assert.equal(mermaidSource(markdown), 'erDiagram\n  users {\n    uuid id\n  }');
  });

  it('refuses a markdown file without a mermaid block', () => {
    assert.throws(() => mermaidSource('# Nothing\n\n```sql\nselect 1;\n```\n'), /no mermaid block/);
  });

  it('reads the generated ERD as an erDiagram', () => {
    const erd = mermaidSource(readFileSync(inRepo('docs/diagrams/erd.md'), 'utf8'));

    assert.match(erd, /^erDiagram\n/);
  });
});
