import type { Provider } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { Clock } from '../common/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fixedClock } from './time.js';

export const FAKE_TRANSACTION = { name: 'fake transaction' };

export type FakeTransactionModule = { providers: Provider[] } & (
  { now: Date } | { clock: Pick<Clock, 'now'> }
);

export class FakePrisma {
  $transaction<T>(work: (client: typeof FAKE_TRANSACTION) => Promise<T>): Promise<T> {
    return work(FAKE_TRANSACTION);
  }
}

export function fakeTransactionModule(setup: FakeTransactionModule): TestingModuleBuilder {
  return Test.createTestingModule({ providers: [...setup.providers, PrismaService, Clock] })
    .overrideProvider(PrismaService)
    .useValue(new FakePrisma())
    .overrideProvider(Clock)
    .useValue('clock' in setup ? setup.clock : fixedClock(setup.now));
}
