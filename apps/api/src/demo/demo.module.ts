import { Module } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { PlansModule } from '../modules/plans/index.js';
import { ResumeVersionsRepository } from '../modules/resumes/index.js';
import { SearchesRepository } from '../modules/searches/index.js';
import { SeedModule } from '../seed/seed.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { DemoRepository } from './demo.repository.js';
import { DemoService } from './demo.service.js';
import { DemoCvFiles } from './demo-cv-files.service.js';
import { DemoStoryWriter } from './demo-story-writer.service.js';

@Module({
  imports: [SeedModule, PlansModule, StorageModule],
  providers: [
    DemoRepository,
    SearchesRepository,
    ResumeVersionsRepository,
    DemoStoryWriter,
    DemoService,
    DemoCvFiles,
    Clock,
  ],
})
export class DemoModule {}
