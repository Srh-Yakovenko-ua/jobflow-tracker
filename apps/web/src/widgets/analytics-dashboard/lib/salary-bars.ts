import {
  type SalaryOutcome,
  type SalaryRange,
  type SalaryResponse,
  THRESHOLDS,
} from '@jobflow/shared';

import { formatAmount } from '@/entities/application';
import { uk } from '@/shared/i18n';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import {
  type BarColour,
  DRAWN_LOOK,
  type EvidenceView,
  type IntervalBarRow,
  type NoteLine,
} from './interval-bars';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.salary;

const TABLE = COPY.table;

const THOUSAND = 1000;

const OUTCOME_COLOURS: Record<SalaryOutcome, BarColour> = {
  offer: 'offer',
  salary_rejection: 'rejected',
  other: 1,
};

type OutcomeGroup = SalaryResponse['outcomes'][number];

type NamedRange = SalaryRange & Readonly<{ key: string; name: string }>;

const dollarsOf = (value: number) => COPY.dollars(formatAmount(value));

const thousandsOf = (value: number) => COPY.thousands(value / THOUSAND);

const nameOf = ({ key }: OutcomeGroup) => COPY.outcomes[key];

function barOf(group: OutcomeGroup): IntervalBarRow {
  const { applications, median, low, high } = group;
  return {
    label: [nameOf(group), ANALYTICS.search.applications(applications)],
    value: median,
    whisker: [low, high],
    tip: [COPY.tip.median(dollarsOf(median)), COPY.tip.range(dollarsOf(low), dollarsOf(high))],
    colour: OUTCOME_COLOURS[group.key],
  };
}

function notesOf({ median, missing, unconverted }: SalaryResponse): NoteLine[] {
  return [
    ...(median === null ? [] : [{ key: 'median', text: COPY.median(dollarsOf(median)) }]),
    ...(missing > 0 ? [{ key: 'missing', text: COPY.missing(missing) }] : []),
    ...(unconverted > 0 ? [{ key: 'unconverted', text: COPY.unconverted(unconverted) }] : []),
  ];
}

function smallOf(group: OutcomeGroup): NoteLine {
  return { key: group.key, text: COPY.small(nameOf(group), group.applications) };
}

function groupsOf({ outcomes, seniority, stack }: SalaryResponse): NamedRange[] {
  return [
    ...outcomes.map((group) => ({ ...group, key: `outcome-${group.key}`, name: nameOf(group) })),
    ...seniority.map((group) => ({
      ...group,
      key: `seniority-${group.key}`,
      name: COPY.seniorities[group.key],
    })),
    ...stack.map((group) => ({ ...group, key: `stack-${group.key}`, name: group.key })),
  ];
}

function rowOf({ key, name, applications, median, low, high }: NamedRange): ChartTableRow {
  return {
    key,
    cells: [
      { text: name },
      { text: String(applications) },
      { text: dollarsOf(median) },
      { text: COPY.range(dollarsOf(low), dollarsOf(high)) },
    ],
  };
}

export function salaryBarsOf(data: SalaryResponse): EvidenceView {
  if (data.withSalary === 0) {
    const leftOut = notesOf({ ...data, median: null }).map(({ text }) => text);
    return {
      status: 'empty',
      content: { ...COPY.empty, hint: [COPY.empty.hint, ...leftOut].join(' ') },
    };
  }
  return {
    status: 'plotted',
    chart: {
      rows: data.outcomes.map(barOf),
      names: { series: COPY.series, caption: TABLE.caption },
      scale: { step: THOUSAND, tick: thousandsOf, format: dollarsOf },
      look: DRAWN_LOOK.timings,
    },
    notes: notesOf(data),
    small: data.outcomes
      .filter((group) => group.applications < THRESHOLDS.MIN_N_PERCENT)
      .map(smallOf),
    table: {
      caption: TABLE.caption,
      heads: [TABLE.group, TABLE.applications, TABLE.median, TABLE.range],
      rows: groupsOf(data).map(rowOf),
    },
  };
}
