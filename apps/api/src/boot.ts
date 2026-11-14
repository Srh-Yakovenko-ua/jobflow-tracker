import type { NestApplicationOptions } from '@nestjs/common';
import { pino } from 'pino';

import { errorMessageOf } from './common/error-message.js';

export const BOOT_OPTIONS = {
  bufferLogs: true,
  logger: false,
  abortOnError: false,
} satisfies NestApplicationOptions;

export const bootLogger = pino();

export async function boot(start: () => Promise<unknown>): Promise<void> {
  try {
    await start();
  } catch (error) {
    bootLogger.fatal(errorMessageOf(error));
    process.exit(1);
  }
}
