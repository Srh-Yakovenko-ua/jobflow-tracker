import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/index.js';
import { PushController } from './push.controller.js';
import { PushProcessor } from './push.processor.js';
import { PushRepository } from './push.repository.js';
import { PushService } from './push.service.js';
import { PushSubscriber } from './push.subscriber.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { PushSendService } from './push-send.service.js';
import { PushSender } from './push-sender.js';

@Module({
  controllers: [PushController],
  providers: [PushService, PushRepository, PushSender],
})
export class PushModule {}

@Module({
  imports: [OutboxWorkerModule, SettingsModule, NotificationsModule],
  providers: [
    Clock,
    PushRepository,
    PushSender,
    PushSubscriber,
    PushDeliveryService,
    PushSendService,
    PushProcessor,
  ],
})
export class PushWorkerModule {}
