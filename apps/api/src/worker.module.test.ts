import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from './config/app-config.js';
import { AiProcessor } from './modules/ai/index.js';
import { ApplicationLiveSubscriber } from './modules/applications/index.js';
import { JwtKeys } from './modules/auth/index.js';
import { CaptureSubscriber } from './modules/capture/index.js';
import { LivePublisher } from './modules/live/index.js';
import { MaintenanceProcessor, MaintenanceScheduler } from './modules/maintenance/index.js';
import {
  MatchQueueService,
  MatchSubscriber,
  MatchTriggerProcessor,
  MatchTriggerSubscriber,
} from './modules/match/index.js';
import { RemindersSubscriber } from './modules/reminders/index.js';
import { ResumeProfileSubscriber } from './modules/resumes/index.js';
import { DomainEventsProcessor } from './outbox/domain-events.processor.js';
import { RedisService } from './redis/redis.service.js';
import { testJwtKeys } from './test/auth.js';
import { FakeDependency } from './test/fake-dependency.js';
import { stubQueues } from './test/stub-queues.js';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles with the validated config, the pino logger, the processors, the scheduler, the subscribers and the live publisher', async () => {
    const moduleRef = await stubQueues(
      Test.createTestingModule({ imports: [WorkerModule] })
        .overrideProvider(JwtKeys)
        .useValue(testJwtKeys)
        .overrideProvider(RedisService)
        .useValue(new FakeDependency()),
    ).compile();

    expect(moduleRef.get<AppConfig>(ConfigService).get('PORT', { infer: true })).toBe(4000);
    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
    for (const provider of [
      MaintenanceProcessor,
      DomainEventsProcessor,
      AiProcessor,
      MaintenanceScheduler,
      CaptureSubscriber,
      ResumeProfileSubscriber,
      ApplicationLiveSubscriber,
      MatchSubscriber,
      MatchQueueService,
      MatchTriggerSubscriber,
      MatchTriggerProcessor,
      LivePublisher,
      RemindersSubscriber,
    ]) {
      expect(moduleRef.get(provider, { strict: false })).toBeInstanceOf(provider);
    }

    await moduleRef.close();
  });
});
