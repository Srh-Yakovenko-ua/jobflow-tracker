import { Global, Module } from '@nestjs/common';

import { MetricsRegistry } from './metrics-registry.js';

@Global()
@Module({
  providers: [MetricsRegistry],
  exports: [MetricsRegistry],
})
export class MetricsModule {}
