import {
  type LatestPlanResponse,
  type PlanItem,
  planItemParamsSchema,
  type PlanItemPatch,
  planItemPatchSchema,
} from '@jobflow/shared';
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { PlansService } from './plans.service.js';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('latest')
  latest(@CurrentUser() user: AccessUser): Promise<LatestPlanResponse> {
    return this.plans.latest(user.id);
  }

  @Patch(':planId/items/:itemId')
  patchItem(
    @CurrentUser() user: AccessUser,
    @Param('planId', { schema: planItemParamsSchema.shape.planId }) planId: string,
    @Param('itemId', { schema: planItemParamsSchema.shape.itemId }) itemId: string,
    @Body({ schema: planItemPatchSchema }) patch: PlanItemPatch,
  ): Promise<PlanItem> {
    return this.plans.patchItem(user.id, { planId, itemId, patch });
  }
}
