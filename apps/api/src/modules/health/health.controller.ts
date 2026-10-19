import { Controller, Get } from '@nestjs/common';

import { type Health, HealthService, type Readiness } from './health.service.js';

@Controller()
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
