import type { NestApplicationOptions } from '@nestjs/common';
import { pino } from 'pino';

export const BOOT_OPTIONS = {
  bufferLogs: true,
  logger: false,
  abortOnError: false,
} satisfies NestApplicationOptions;

export const bootLogger = pino();

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function boot(start: () => Promise<unknown>): Promise<void> {
  try {
    await start();
  } catch (error) {
    bootLogger.fatal(describeFailure(error));
    process.exit(1);
  }
}
