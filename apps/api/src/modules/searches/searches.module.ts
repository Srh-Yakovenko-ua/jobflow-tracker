import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { ApplicationsModule } from '../applications/index.js';
import { SearchesController } from './searches.controller.js';
import { SearchesRepository } from './searches.repository.js';
import { SearchesService } from './searches.service.js';

@Module({
  imports: [ApplicationsModule],
  controllers: [SearchesController],
  providers: [SearchesService, SearchesRepository, Clock],
})
export class SearchesModule {}
