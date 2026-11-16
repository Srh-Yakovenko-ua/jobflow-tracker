import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { SettingsController } from './settings.controller.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [SettingsController],
  providers: [Clock, SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}
