import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { boot, BOOT_OPTIONS, bootLogger } from './boot.js';

const ENV_ERROR = 'Invalid environment:\n✖ Invalid input\n  → at DATABASE_URL';

@Module({
  providers: [
    {
      provide: 'broken',
      useFactory: () => {
        throw new Error(ENV_ERROR);
      },
    },
  ],
})
class BrokenModule {}

describe('boot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a failed boot once through pino without the stack and exits 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const fatal = vi.spyOn(bootLogger, 'fatal').mockImplementation(() => undefined);
    const stderr = vi.spyOn(process.stderr, 'write');
    const stdout = vi.spyOn(process.stdout, 'write');

    await boot(() => NestFactory.createApplicationContext(BrokenModule, BOOT_OPTIONS));

    expect(fatal).toHaveBeenCalledExactlyOnceWith(ENV_ERROR);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
  });
});
