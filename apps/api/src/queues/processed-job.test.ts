import { Logger } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import { memoryLog } from '../test/memory-log.js';
import { processedJob } from '../test/processed-job.js';
import { compileProcessorModule } from '../test/processor.js';
import { failedJobFields, warnWorkerError } from './processed-job.js';

const NOTE_TEXT = 'Olena private note about Acme salary';

const log = memoryLog();

const validationError = () =>
  new Prisma.PrismaClientValidationError(
    `Invalid \`prisma.note.create()\` invocation:\n{\n  data: {\n    bdy: "${NOTE_TEXT}"\n  }\n}`,
    { clientVersion: Prisma.prismaVersion.client },
  );

describe('failed job logs', () => {
  const logger = new Logger('JobsUnderTest');
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await compileProcessorModule(log.sink, []);
  });

  beforeEach(() => {
    log.lines.length = 0;
  });

  afterAll(() => moduleRef.close());

  it.each([
    {
      case: 'a failed job',
      write: (error: Error) => {
        const job = processedJob({ queueName: 'domain-events', name: 'x', data: {} });
        logger.warn(failedJobFields(job, error), 'job failed');
      },
    },
    {
      case: 'a worker error',
      write: (error: Error) => {
        warnWorkerError(logger, { queue: 'domain-events', error });
      },
    },
  ])('a failed job with a Prisma validation error logs no call arguments: $case', ({ write }) => {
    write(validationError());

    expect(log.lines.join('\n')).not.toContain(NOTE_TEXT);
    expect(log.parsed()).toMatchObject([{ err: { type: 'PrismaClientValidationError' } }]);
  });
});
