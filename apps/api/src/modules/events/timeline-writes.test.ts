import { globSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = new URL('../../', import.meta.url);

const TIMELINE_TABLE = /\btimelineEvents?\b|\btimeline_events\b/;

const NOT_SCANNED = ['**/*.test.ts', 'test/**', 'generated/**'];

const EVENTS_MODULE = 'modules/events/';

function filesNamingTheTimelineTable(): string[] {
  return globSync('**/*.ts', { cwd: SOURCE_ROOT, exclude: NOT_SCANNED }).filter((file) =>
    TIMELINE_TABLE.test(readFileSync(new URL(file, SOURCE_ROOT), 'utf8')),
  );
}

describe('the timeline_events table', () => {
  const naming = filesNamingTheTimelineTable();

  it('is named by no source file outside the events module', () => {
    expect(naming.filter((file) => !file.startsWith(EVENTS_MODULE))).toEqual([]);
  });

  it('is found in the events repository, so the scan reads real source', () => {
    expect(naming).toContain(`${EVENTS_MODULE}timeline.repository.ts`);
  });
});
