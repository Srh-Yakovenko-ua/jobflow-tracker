import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';

import { RequestId } from '../../common/request-id.decorator.js';
import {
  type JobAccepted,
  type MaintenanceScheduleId,
  maintenanceScheduleIdSchema,
  type PingBody,
  pingBodySchema,
} from './maintenance.jobs.js';
import { MaintenanceService } from './maintenance.service.js';

@Controller('dev/jobs')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('ping')
  @HttpCode(202)
  ping(
    @Body({ schema: pingBodySchema }) body: PingBody,
    @RequestId() requestId: string,
  ): Promise<JobAccepted> {
    return this.maintenanceService.enqueuePing({ requestId, ...body });
  }

  @Post(':schedule')
  @HttpCode(202)
  runNow(
    @Param('schedule', { schema: maintenanceScheduleIdSchema }) schedule: MaintenanceScheduleId,
    @RequestId() requestId: string,
  ): Promise<JobAccepted> {
    return this.maintenanceService.runNow({ schedule, requestId });
  }
}
