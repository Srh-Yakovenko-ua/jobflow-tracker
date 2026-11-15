import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { ACCOUNT_EVENTS, exportRequestedPayloadSchema } from './account.events.js';
import { AccountExportService } from './account-export.service.js';

@Injectable()
export class AccountExportSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly exports: AccountExportService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: ACCOUNT_EVENTS.exportRequested,
      schema: exportRequestedPayloadSchema,
      label: 'export event',
      handle: (requested) => this.exports.build(requested),
    });
  }
}
