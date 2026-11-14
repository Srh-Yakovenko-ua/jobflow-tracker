import { Module } from '@nestjs/common';

import { JwtKeysModule } from '../modules/auth/index.js';
import { AnalyticsClient } from './analytics-client.js';

@Module({
  imports: [JwtKeysModule],
  providers: [AnalyticsClient],
  exports: [AnalyticsClient],
})
export class AnalyticsClientModule {}
