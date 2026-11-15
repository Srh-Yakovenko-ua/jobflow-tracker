import {
  canTransition,
  type ImportedStageEvent,
  type ImportRow,
  type ImportRowError,
  type RejectionReasonCode,
  type Stage,
  STAGES,
} from '@jobflow/shared';

import { refusalOf } from './stage-transition-rules.js';

export type ImportedFields = Pick<
  ImportRow,
  'company' | 'position' | 'source' | 'url' | 'salaryMin' | 'salaryMax' | 'currency'
>;

export type ImportedEvent = {
  fromStage: Stage | null;
  toStage: Stage;
  reasonCode: RejectionReasonCode | null;
  occurredAt: Date;
};

export type ImportedApplication = {
  fields: ImportedFields;
  currentStage: Stage;
  appliedAt: Date;
  lastEventAt: Date;
  events: ImportedEvent[];
};

export type RowIssue = Omit<ImportRowError, 'row'>;

export type RowOutcome = { application: ImportedApplication } | { issues: RowIssue[] };

const FIRST_STAGE = 'applied' satisfies Stage;

function shortestPathTo(target: Stage): Stage[] {
  const paths = new Map<Stage, Stage[]>([[FIRST_STAGE, [FIRST_STAGE]]]);
  const queue: Stage[] = [FIRST_STAGE];
  for (const stage of queue) {
    const path = paths.get(stage) ?? [];
    for (const next of STAGES.filter((to) => !paths.has(to) && canTransition(stage, to).ok)) {
      paths.set(next, [...path, next]);
      queue.push(next);
    }
  }
  return paths.get(target) ?? [FIRST_STAGE];
}

const syntheticHistory = ({ stage, appliedAt }: ImportRow): ImportedStageEvent[] =>
  shortestPathTo(stage).map((toStage) => ({ toStage, reasonCode: null, occurredAt: appliedAt }));

function refusedMoves(history: readonly ImportedStageEvent[]): RowIssue[] {
  return history.flatMap(({ toStage }, index) => {
    const from = history[index - 1]?.toStage;
    if (from === undefined) {
      return [];
    }
    const transition = { from, to: toStage, stageBeforeGhosted: history[index - 2]?.toStage };
    const reason = refusalOf(transition);
    return reason === null
      ? []
      : [
          {
            path: `stageHistory.${String(index)}.toStage`,
            message: `${from} -> ${toStage}: ${reason}`,
          },
        ];
  });
}

const eventsOf = (history: readonly ImportedStageEvent[]): ImportedEvent[] =>
  history.map(({ toStage, reasonCode, occurredAt }, index) => ({
    fromStage: history[index - 1]?.toStage ?? null,
    toStage,
    reasonCode: reasonCode ?? (toStage === 'rejected' ? 'unspecified' : null),
    occurredAt: new Date(occurredAt),
  }));

export function importedApplicationOf(row: ImportRow): RowOutcome {
  const history = row.stageHistory ?? syntheticHistory(row);
  const issues = refusedMoves(history);
  const events = eventsOf(history);
  const last = events.at(-1);
  if (issues.length > 0 || last === undefined) {
    return { issues };
  }
  const { company, position, source, url, salaryMin, salaryMax, currency } = row;
  return {
    application: {
      fields: { company, position, source, url, salaryMin, salaryMax, currency },
      currentStage: last.toStage,
      appliedAt: new Date(row.appliedAt),
      lastEventAt: last.occurredAt,
      events,
    },
  };
}
