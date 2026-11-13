import type { Stage } from '@jobflow/shared';

import type {
  FollowupSourceQuery,
  FollowupSourceRow,
  LatestFollowupDraft,
  LatestFollowupJob,
  RecordFollowupRequested,
} from '../modules/followups/index.js';
import type { ResolveFollowups } from '../modules/reminders/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { applicationPath } from './applications.js';
import { ownedStageApplication } from './reminders.js';
import { APPLICATION_ID, OLENA_ID } from './service-fixtures.js';
import { daysBefore } from './time.js';

export type FollowupApplication = { stage?: Stage; isDraft?: boolean };

export const FOLLOWUP_SOURCE_ROW: FollowupSourceRow = {
  company: 'Acme',
  position: 'Senior React developer',
  rawText: 'Шукаємо Senior React developer у команду Acme, повністю віддалено',
  isDraft: false,
  currentStage: 'tech_interview',
  lastEventAt: daysBefore(6),
  contacts: [{ name: 'Оксана Петренко' }],
  scheduledEvents: [{ kind: 'tech_interview', startsAt: daysBefore(7) }],
  user: { displayName: 'Андрій', settings: { timezone: 'Europe/Kyiv' } },
};

type Reach = { userId: string; applicationId: string };

const ownedOrNull = <Row>({ userId, applicationId }: Reach, row: Row): Promise<Row | null> =>
  Promise.resolve(userId === OLENA_ID && applicationId === APPLICATION_ID ? row : null);

export class FakeFollowupsRepository {
  source: FollowupSourceRow = FOLLOWUP_SOURCE_ROW;

  draft: LatestFollowupDraft | null = null;

  job: LatestFollowupJob | null = null;

  runningJobId: string | null = null;

  readonly requested: [string, RecordFollowupRequested][] = [];

  findSource(userId: string, { applicationId }: FollowupSourceQuery) {
    return ownedOrNull({ userId, applicationId }, this.source);
  }

  lockApplication(userId: string, { applicationId }: { applicationId: string }) {
    const locked = { runningJobId: this.runningJobId };
    return ownedOrNull({ userId, applicationId }, locked);
  }

  recordRequested(userId: string, recorded: RecordFollowupRequested): Promise<void> {
    this.requested.push([userId, recorded]);
    return Promise.resolve();
  }

  findLatestDraft(userId: string, applicationId: string) {
    return ownedOrNull({ userId, applicationId }, this.draft);
  }

  findLatestJob(userId: string, applicationId: string) {
    return ownedOrNull({ userId, applicationId }, this.job);
  }
}

export class RecordingFollowupResolver {
  readonly calls: [string, ResolveFollowups][] = [];

  resolveFollowups(userId: string, followups: ResolveFollowups): Promise<number> {
    this.calls.push([userId, followups]);
    return Promise.resolve(1);
  }
}

export const followupPath = (id: string) => `${applicationPath(id)}/followup`;

export function followupOwner(
  prisma: PrismaService,
  { stage = 'tech_interview', isDraft = false }: FollowupApplication = {},
) {
  const { position, rawText, lastEventAt } = FOLLOWUP_SOURCE_ROW;
  return ownedStageApplication(prisma, { stage, lastEventAt, row: { position, rawText, isDraft } });
}
