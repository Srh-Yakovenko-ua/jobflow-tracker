import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { readRequestId } from '../../common/request-id.middleware.js';
import { type JobAccepted, type PingBody, pingBodySchema } from './maintenance.jobs.js';
import { MaintenanceService } from './maintenance.service.js';

@Controller('dev/jobs')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('ping')
  @HttpCode(202)
  ping(
    @Body({ schema: pingBodySchema }) body: PingBody,
    @Req() req: Request,
  ): Promise<JobAccepted> {
    return this.maintenanceService.enqueuePing({ requestId: readRequestId(req), ...body });
  }
}
