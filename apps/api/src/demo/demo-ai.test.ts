import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { demoSummaryOutput } from './demo-ai.js';

const SNAPSHOTS_URL = new URL(
  '../../../../services/analytics/tests/golden/snapshots.json',
  import.meta.url,
);

const resumeAbSchema = z.object({
  resume_ab: z.object({
    versions: z.array(
      z.object({
        number: z.int(),
        conversion: z.object({ successes: z.int(), trials: z.int() }),
      }),
    ),
  }),
});

async function tilePercents() {
  const snapshots = resumeAbSchema.parse(JSON.parse(await readFile(SNAPSHOTS_URL, 'utf8')));
  const percentOf = (number: number) => {
    const version = snapshots.resume_ab.versions.find((candidate) => candidate.number === number);
    const { successes = 0, trials = 1 } = version?.conversion ?? {};
    return `${String(Math.round((successes / trials) * 100))}%`;
  };
  return { v1: percentOf(1), v2: percentOf(2) };
}

describe('the demo monthly summary', () => {
  it('gives the resume A/B tile percents in the summary text and the CV action, not the design ones', async () => {
    const { v1, v2 } = await tilePercents();
    const { summary, actions } = demoSummaryOutput();
    const cvAction = actions.find(({ metric }) => metric === 'Конверсія у скринінг за версією CV');

    expect([v1, v2]).toEqual(['56%', '44%']);
    expect(summary).toContain(`з CV v2 ${v2}, з CV v1 ${v1}`);
    expect(cvAction?.why).toContain(`З CV v2 конверсія у скринінг ${v2}, з CV v1 ${v1}`);
    expect([summary, JSON.stringify(actions)].join(' ')).not.toMatch(/41%|24%/);
    expect(actions.map(({ title }) => title)).not.toContain('Відгукуватися лише з CV v2');
  });
});
