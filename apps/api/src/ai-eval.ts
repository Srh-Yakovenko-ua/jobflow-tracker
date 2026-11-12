import path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';

import { AiEvalModule } from './ai-eval/ai-eval.module.js';
import { AiEvalService } from './ai-eval/ai-eval.service.js';
import { boot, BOOT_OPTIONS } from './boot.js';

const evalKindSchema = z.enum(['vacancy', 'resume', 'match']);

const kind = evalKindSchema.safeParse(process.argv[2]);

if (kind.success) {
  await boot(async () => {
    const app = await NestFactory.createApplicationContext(AiEvalModule, BOOT_OPTIONS);
    app.useLogger(app.get(Logger));
    const casesDir = path.resolve('src/modules/ai/evals', kind.data);
    const { lines, passed } = await app.get(AiEvalService)[kind.data](casesDir);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = passed ? 0 : 1;
    await app.close();
  });
} else {
  process.stderr.write(`Unknown eval kind. Kinds: ${evalKindSchema.options.join(', ')}\n`);
  process.exitCode = 1;
}
