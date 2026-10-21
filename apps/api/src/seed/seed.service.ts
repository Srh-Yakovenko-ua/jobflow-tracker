import { type RegisterInput, REJECTION_REASONS } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { AuthService } from '../modules/auth/index.js';
import { type RejectionReasonRow, SeedRepository } from './seed.repository.js';

export const DEMO_USER = {
  email: 'demo@jobflow.local',
  password: 'jobflow-demo',
  displayName: 'Демо',
} satisfies RegisterInput;

function sharedRejectionReasons(): RejectionReasonRow[] {
  return Object.entries(REJECTION_REASONS).map(([code, reason]) => ({ code, ...reason }));
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly repository: SeedRepository,
    private readonly authService: AuthService,
  ) {}

  async run(): Promise<void> {
    const reasons = await this.repository.upsertRejectionReasons(sharedRejectionReasons());
    this.logger.log(`Seeded ${String(reasons)} rejection reasons`);
    await this.seedDemoUser();
  }

  private async seedDemoUser(): Promise<void> {
    if (await this.repository.hasUser(DEMO_USER.email)) {
      this.logger.log('Demo user already exists, left unchanged');
      return;
    }
    await this.authService.register(DEMO_USER);
    this.logger.log('Demo user created');
  }
}
