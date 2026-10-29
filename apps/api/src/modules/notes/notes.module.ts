import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { EventsModule } from '../events/index.js';
import { NotesController } from './notes.controller.js';
import { NotesRepository } from './notes.repository.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [EventsModule],
  controllers: [NotesController],
  providers: [NotesService, NotesRepository, Clock],
})
export class NotesModule {}
