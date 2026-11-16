import {
  type EmailUnsubscribeInput,
  emailUnsubscribeInputSchema,
  type EmailUnsubscribeResponse,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { Public } from '../auth/index.js';
import { EmailUnsubscribeService } from './email-unsubscribe.service.js';

@Controller('email')
export class EmailController {
  constructor(private readonly unsubscribes: EmailUnsubscribeService) {}

  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  unsubscribe(
    @Body({ schema: emailUnsubscribeInputSchema }) input: EmailUnsubscribeInput,
  ): Promise<EmailUnsubscribeResponse> {
    return this.unsubscribes.unsubscribe(input);
  }
}
