import { Injectable } from '@nestjs/common';

import { MatchTriggerService } from '../modules/match/index.js';
import { AiRematchRepository } from './ai-rematch.repository.js';

@Injectable()
export class AiRematchService {
  constructor(
    private readonly repository: AiRematchRepository,
    private readonly triggers: MatchTriggerService,
  ) {}

  async rematch(email: string): Promise<number | null> {
    const userId = await this.repository.findUserId(email);
    return userId === null ? null : this.triggers.rematchUser(userId);
  }
}
