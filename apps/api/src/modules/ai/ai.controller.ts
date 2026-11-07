import { Controller, Delete, HttpCode } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { AiService } from './ai.service.js';

@Controller('ai-results')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Delete()
  @HttpCode(204)
  deleteResults(@CurrentUser() user: AccessUser): Promise<void> {
    return this.ai.deleteResults(user.id);
  }
}
