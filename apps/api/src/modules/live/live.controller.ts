import type { LiveTicket } from '@jobflow/shared';
import { Controller, type MessageEvent, Post, Sse, UseGuards } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { type AccessUser, CurrentUser, Public } from '../auth/index.js';
import { LiveHub } from './live-hub.service.js';
import { LiveTicketGuard } from './live-ticket.guard.js';
import { LiveTicketsService } from './live-tickets.service.js';

@Controller('events')
export class LiveController {
  constructor(
    private readonly tickets: LiveTicketsService,
    private readonly hub: LiveHub,
  ) {}

  @Post('ticket')
  ticket(@CurrentUser() user: AccessUser): Promise<LiveTicket> {
    return this.tickets.issue(user);
  }

  @Public()
  @UseGuards(LiveTicketGuard)
  @Sse('stream')
  stream(@CurrentUser() user: AccessUser): Observable<MessageEvent> {
    return this.hub.stream(user);
  }
}
