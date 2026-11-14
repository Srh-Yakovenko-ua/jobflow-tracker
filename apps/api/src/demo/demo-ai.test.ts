import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { demoSummaryOutput } from './demo-ai.js';

const SNAPSHOTS_URL = new URL(
  '../../../../services/analytics/tests/golden/snapshots.json',
  import.meta.url,
);

const conversionSchema = z.object({ successes: z.int(), trials: z.int() });

const snapshotsSchema = z.object({
  resume_ab: z.object({
    versions: z.array(z.object({ number: z.int(), conversion: conversionSchema })),
  }),
  funnel: z.object({
    stages: z.array(z.object({ stage: z.string(), conversion: z.unknown() })),
    mostExpensive: z.object({ stage: z.string(), reached: z.int(), passed: z.int() }),
  }),
});

const DEMO_SUMMARY_INPUT = { month: '2026-10', sent: { month: 12, previousMonth: 15 } };

const percentOf = ({ successes, trials }: z.infer<typeof conversionSchema>) =>
  `${String(Math.round((successes / trials) * 100))}%`;

async function dashboardFigures() {
  const snapshots = snapshotsSchema.parse(JSON.parse(await readFile(SNAPSHOTS_URL, 'utf8')));
  const versionPercentOf = (number: number) => {
    const version = snapshots.resume_ab.versions.find((candidate) => candidate.number === number);
    return percentOf(version?.conversion ?? { successes: 0, trials: 1 });
  };
  const applied = snapshots.funnel.stages.find(({ stage }) => stage === 'applied');
  const screening = conversionSchema.parse(applied?.conversion);
  const { reached, passed } = snapshots.funnel.mostExpensive;
  return {
    v1: versionPercentOf(1),
    v2: versionPercentOf(2),
    screening: { percent: percentOf(screening), ...screening },
    mostExpensive: { reached, passed },
  };
}

describe('the demo monthly summary', () => {
  it('gives the resume A/B tile percents in the summary text and the CV action, not the design ones', async () => {
    const { v1, v2 } = await dashboardFigures();
    const { summary, actions } = demoSummaryOutput(DEMO_SUMMARY_INPUT);
    const cvAction = actions.find(({ metric }) => metric === 'Конверсія у скринінг за версією CV');

    expect([v1, v2]).toEqual(['56%', '44%']);
    expect(summary).toContain(`з CV v2 ${v2}, з CV v1 ${v1}`);
    expect(cvAction?.why).toContain(`З CV v2 конверсія у скринінг ${v2}, з CV v1 ${v1}`);
    expect([summary, JSON.stringify(actions)].join(' ')).not.toMatch(/41%|24%/);
    expect(actions.map(({ title }) => title)).not.toContain('Відгукуватися лише з CV v2');
  });

  it('names the month it is given and the one before', () => {
    const { summary } = demoSummaryOutput(DEMO_SUMMARY_INPUT);

    expect(summary).toMatch(/^За жовтень ти надіслав 12 відгуків, на 3 менше, ніж за вересень\. /);
    expect(summary).not.toMatch(/серпень|липн/);
  });

  it('gives the screening conversion and the most expensive stage the dashboard shows', async () => {
    const { screening, mostExpensive } = await dashboardFigures();
    const { summary } = demoSummaryOutput(DEMO_SUMMARY_INPUT);

    expect({ screening, mostExpensive }).toEqual({
      screening: { percent: '43%', successes: 17, trials: 40 },
      mostExpensive: { reached: 9, passed: 4 },
    });
    expect(summary).toContain(
      `До скринінгу дійшло ${String(screening.successes)} з ${String(screening.trials)} відгуків, це ${screening.percent}.`,
    );
    expect(summary).toContain(
      `з ${String(mostExpensive.reached)} ти пройшов ${String(mostExpensive.passed)}, і в 3 з 4 відмов`,
    );
  });

  it('quotes no forecast range in the text or the actions, since the demo dashboard simulates its own', () => {
    const { summary, actions } = demoSummaryOutput(DEMO_SUMMARY_INPUT);
    const techAction = actions.find(
      ({ title }) => title === "Два тижні алгоритмів перед техінтерв'ю",
    );

    expect([summary, JSON.stringify(actions)].join(' ')).not.toMatch(/від \d+ до \d+ тижнів/);
    expect(summary).not.toContain('Прогноз офера');
    expect(techAction?.expectedEffect).toBe(
      "Якщо конверсія техінтерв'ю дійде до 60%, прогноз офера на дашборді стане коротшим.",
    );
  });
});
