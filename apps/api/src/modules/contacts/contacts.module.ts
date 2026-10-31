import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { EventsModule } from '../events/index.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsRepository } from './contacts.repository.js';
import { ContactsService } from './contacts.service.js';

@Module({
  imports: [EventsModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository, Clock],
})
export class ContactsModule {}
