import { Injectable } from '@nestjs/common';

import { AnalyticsCacheService } from '../modules/analytics-cache/index.js';
import type { PutObject } from '../storage/file-storage.js';
import { DemoService } from './demo.service.js';
import { DemoCvFiles } from './demo-cv-files.service.js';

@Injectable()
export class DemoReseed {
  constructor(
    private readonly demo: DemoService,
    private readonly cvFiles: DemoCvFiles,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async run(): Promise<PutObject[]> {
    const { userId, cvFiles } = await this.demo.run();
    await this.cvFiles.store(cvFiles);
    await this.analyticsCache.invalidate(userId);
    return cvFiles;
  }
}
