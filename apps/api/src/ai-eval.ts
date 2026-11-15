import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';

import { AiEvalModule } from './ai-eval/ai-eval.module.js';
import { AiEvalService } from './ai-eval/ai-eval.service.js';
import { boot, BOOT_OPTIONS } from './boot.js';

const evalKindSchema = z.enum([
  'vacancy',
  'resume',
  'match',
  'followup',
  'cv-hints',
  'interview-prep',
]);

const EVAL_METHODS = {
  vacancy: 'vacancy',
  resume: 'resume',
  match: 'match',
  followup: 'followup',
  'cv-hints': 'cvHints',
  'interview-prep': 'interviewPrep',
} as const satisfies Record<z.infer<typeof evalKindSchema>, keyof AiEvalService>;

const [kindArgument, outFile] = process.argv.slice(2);

const kind = evalKindSchema.safeParse(kindArgument);

if (kind.success) {
  await boot(async () => {
    const app = await NestFactory.createApplicationContext(AiEvalModule, BOOT_OPTIONS);
    app.useLogger(app.get(Logger));
    const casesDir = path.resolve('src/modules/ai/evals', kind.data);
    const evals = app.get(AiEvalService);
    const { lines, passed } = await evals[EVAL_METHODS[kind.data]](casesDir);
    const snapshot = `${[...lines, '', ...evals.usageLines()].join('\n')}\n`;
    process.stdout.write(snapshot);
    if (outFile !== undefined) {
      await writeFile(path.resolve(outFile), snapshot);
    }
    process.exitCode = passed ? 0 : 1;
    await app.close();
  });
} else {
  process.stderr.write(`Unknown eval kind. Kinds: ${evalKindSchema.options.join(', ')}\n`);
  process.exitCode = 1;
}
