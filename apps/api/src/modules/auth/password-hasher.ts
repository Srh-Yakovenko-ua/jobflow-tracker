import { randomBytes } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private dummy = '';

  get dummyHash(): string {
    return this.dummy;
  }

  async onModuleInit(): Promise<void> {
    this.dummy = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  verify(digest: string, password: string): Promise<boolean> {
    return argon2.verify(digest, password);
  }
}
