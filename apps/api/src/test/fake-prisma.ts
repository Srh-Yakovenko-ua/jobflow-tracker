import type { Provider } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { Clock } from '../common/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const FAKE_TRANSACTION = { name: 'fake transaction' };

export type FakeTransactionModule = { providers: Provider[]; now: Date };

export class FakePrisma {
  $transaction<T>(work: (client: typeof FAKE_TRANSACTION) => Promise<T>): Promise<T> {
    return work(FAKE_TRANSACTION);
  }
}

export function fakeTransactionModule({
  providers,
  now,
}: FakeTransactionModule): TestingModuleBuilder {
  return Test.createTestingModule({ providers: [...providers, PrismaService, Clock] })
    .overrideProvider(PrismaService)
    .useValue(new FakePrisma())
    .overrideProvider(Clock)
    .useValue({ now: () => now });
}
