import type { Health, Readiness } from '@jobflow/shared';
import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/index.js';
import { HealthService } from './health.service.js';

@Controller()
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health(): Health {
    return this.healthService.liveness();
  }

  @Get('ready')
  ready(): Promise<Readiness> {
    return this.healthService.readiness();
  }
}
