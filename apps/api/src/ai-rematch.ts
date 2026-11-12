import { parseArgs } from 'node:util';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AiRematchModule } from './ai-rematch/ai-rematch.module.js';
import { AiRematchService } from './ai-rematch/ai-rematch.service.js';
import { boot, BOOT_OPTIONS } from './boot.js';

const { values } = parseArgs({ options: { user: { type: 'string' } } });

const email = values.user;

if (email === undefined) {
  process.stderr.write('Usage: pnpm ai:rematch --user <email>\n');
  process.exitCode = 1;
} else {
  await boot(async () => {
    const app = await NestFactory.createApplicationContext(AiRematchModule, BOOT_OPTIONS);
    app.useLogger(app.get(Logger));
    const queued = await app.get(AiRematchService).rematch(email);
    if (queued === null) {
      process.stderr.write(`No user with the email ${email}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`Queued ${String(queued)} match triggers for ${email}\n`);
    }
    await app.close();
  });
}
