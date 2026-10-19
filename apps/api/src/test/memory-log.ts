import type { TestingModuleBuilder } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { loggerParams } from '../common/logger.js';

export type LogLine = Record<string, unknown>;

export function memoryLog() {
  const lines: string[] = [];
  const sink = {
    write: (line: string) => {
      lines.push(line);
    },
  };
  const parsed = () => lines.map((line) => JSON.parse(line) as LogLine);
  return { lines, sink, parsed };
}

export function withLogSink(
  builder: TestingModuleBuilder,
  sink: DestinationStream,
): TestingModuleBuilder {
  return builder.overrideProvider(PARAMS_PROVIDER_TOKEN).useValue(loggerParams(sink));
}
