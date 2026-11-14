import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { PlansService } from '../modules/plans/index.js';
import { DEMO_USER, SeedService } from '../seed/seed.service.js';
import { loadDemoStory, shiftStory } from './demo-story.js';
import { DemoStoryWriter } from './demo-story-writer.service.js';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly seed: SeedService,
    private readonly writer: DemoStoryWriter,
    private readonly plans: PlansService,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<void> {
    await this.seed.run();
    const story = shiftStory(await loadDemoStory(), { now: this.clock.now() });
    const { userId, summary, matches } = await this.writer.replace({
      email: DEMO_USER.email,
      story,
    });
    const plan = await this.plans.createFromSummary(userId, summary);
    const events = story.applications.reduce((sum, { events }) => sum + events.length, 0);
    this.logger.log(
      `Demo story seeded: ${String(story.applications.length)} applications, ${String(events)} stage events, ${String(story.resumeVersions.length)} resume versions, ${String(matches)} matches, summary for ${summary.month} with ${String(plan.items.length)} plan items`,
    );
  }
}
