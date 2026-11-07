import type { OpenApplicationChoice } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApplicationListRepository } from './application-list.repository.js';
import { APPLICATION_EVENTS, type ApplicationEvent, stageChanged } from './applications.events.js';
import { ApplicationsRepository } from './applications.repository.js';
import {
  type InSearch,
  type OpenApplication,
  SearchApplicationsRepository,
  type SearchTotalsRow,
  type WithdrawalEvent,
} from './search-applications.repository.js';
import { refuseIllegalTransition } from './stage-transition-rules.js';

export type HandOver = {
  fromSearchId: string;
  toSearchId: string;
  choice: OpenApplicationChoice;
  now: Date;
  tx: Prisma.TransactionClient;
};

export type SearchTotals = Omit<SearchTotalsRow, 'searchId'>;

export type SearchTotalsOf = (searchId: string) => SearchTotals;

type OpenHandOver = { open: OpenApplication[]; handOver: HandOver };

export const NO_TOTALS: SearchTotals = {
  applications: 0,
  interviews: 0,
  offers: 0,
  firstOfferAt: null,
};

function withdrawalOf({ id, currentStage }: OpenApplication, now: Date): WithdrawalEvent {
  refuseIllegalTransition({ from: currentStage, to: 'withdrawn', stageBeforeGhosted: null });
  return {
    applicationId: id,
    fromStage: currentStage,
    toStage: 'withdrawn',
    reasonCode: null,
    comment: null,
    occurredAt: now,
    compensatesEventId: null,
    createdAt: now,
  };
}

function changedEvery(changed: number, open: readonly OpenApplication[]): void {
  if (changed !== open.length) {
    throw conflict('An open application changed while the search was being finished');
  }
}

@Injectable()
export class SearchApplicationsService {
  constructor(
    private readonly repository: SearchApplicationsRepository,
    private readonly applications: ApplicationsRepository,
    private readonly applicationList: ApplicationListRepository,
  ) {}

  searchExists(userId: string, inSearch: InSearch): Promise<boolean> {
    return this.applicationList.searchExists(userId, inSearch);
  }

  async handOver(userId: string, handOver: HandOver): Promise<void> {
    const { fromSearchId, tx } = handOver;
    const open = await this.repository.lockOpen(userId, { searchId: fromSearchId, tx });
    const events = await this.handedOver(userId, { open, handOver });
    await this.applications.recordEvents(userId, { events, tx });
  }

  async totalsOf(userId: string, searchIds: readonly string[]): Promise<SearchTotalsOf> {
    const rows = await this.repository.totalsOf(userId, searchIds);
    const totals = new Map(rows.map(({ searchId, ...row }) => [searchId, row]));
    return (searchId) => totals.get(searchId) ?? NO_TOTALS;
  }

  private handedOver(userId: string, step: OpenHandOver): Promise<ApplicationEvent[]> {
    const { choice } = step.handOver;
    switch (choice) {
      case 'move':
        return this.moved(userId, step);
      case 'withdraw':
        return this.withdrawn(userId, step);
      default: {
        const unhandled: never = choice;
        throw new Error(`Unhandled open application choice ${String(unhandled)}`);
      }
    }
  }

  private async withdrawn(userId: string, { open, handOver }: OpenHandOver) {
    const { now, tx } = handOver;
    const events = open.map((application) => withdrawalOf(application, now));
    changedEvery(await this.repository.withdraw(userId, { events, lastEventAt: now, tx }), open);
    return events.map((event) => stageChanged({ id: event.applicationId, event }));
  }

  private async moved(userId: string, { open, handOver }: OpenHandOver) {
    const { fromSearchId, toSearchId, tx } = handOver;
    const ids = open.map(({ id }) => id);
    changedEvery(await this.repository.moveTo(userId, { ids, fromSearchId, toSearchId, tx }), open);
    return ids.map((applicationId): ApplicationEvent => ({
      eventType: APPLICATION_EVENTS.updated,
      applicationId,
      fields: ['searchId'],
    }));
  }
}
