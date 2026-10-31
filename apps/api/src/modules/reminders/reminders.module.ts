import { Module } from '@nestjs/common';

import { RemindersRepository } from './reminders.repository.js';
import { RemindersService } from './reminders.service.js';

@Module({
  providers: [RemindersService, RemindersRepository],
  exports: [RemindersService],
})
export class RemindersModule {}
